"""
Function-based DRF views reproducing the ASP.NET Core `/api/*` contract, backed
by the shared SQLite database via the unmanaged models in models.py.
"""
import json
from datetime import datetime, timezone

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import passwords, serializers
from .models import (
    AppUser,
    Company,
    DevelopmentMilestone,
    Employee,
    Ingredient,
    InventoryAlert,
    Location,
    MenuItem,
    PurchaseOrder,
    PurchaseOrderItem,
    RevenueDataPoint,
    Vendor,
    VendorProductPrice,
)


def _companies_by_id():
    return {c.id: c.name for c in Company.objects.all()}


def _locations_by_id():
    return {l.id: l.name for l in Location.objects.all()}


@api_view(["GET"])
def health(request):
    return Response(
        {
            "status": "healthy",
            "service": "Bisync.cloud API (Django)",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@api_view(["POST"])
def login(request):
    body = request.data or {}
    email = (body.get("email") or "").strip()
    password = body.get("password") or ""
    if not email or not password:
        return Response("Email and password are required.", status=status.HTTP_400_BAD_REQUEST)

    normalized = email.lower()
    user = next(
        (u for u in AppUser.objects.all() if (u.email or "").lower() == normalized),
        None,
    )
    if user is None or not user.active:
        return Response(
            {"message": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED
        )

    valid = passwords.verify(password, user.password_hash)
    if not valid and not (user.password_hash or "").strip():
        valid = password == passwords.DEMO_PASSWORD
    if not valid:
        return Response(
            {"message": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED
        )

    employee_code = None
    if user.employee_id:
        emp = Employee.objects.filter(id=user.employee_id).first()
        employee_code = emp.employee_code if emp else None

    return Response(
        serializers.user_dict(user, _companies_by_id(), _locations_by_id(), employee_code)
    )


@api_view(["GET"])
def users(request):
    companies = _companies_by_id()
    locations = _locations_by_id()
    emp_codes = {e.id: e.employee_code for e in Employee.objects.all()}
    rows = AppUser.objects.all().order_by("full_name")
    return Response(
        [
            serializers.user_dict(u, companies, locations, emp_codes.get(u.employee_id))
            for u in rows
        ]
    )


@api_view(["GET"])
def companies(request):
    location_counts = {}
    for l in Location.objects.all():
        if l.company_id is not None:
            location_counts[l.company_id] = location_counts.get(l.company_id, 0) + 1
    rows = Company.objects.all().order_by("name")
    return Response(
        [serializers.company_dict(c, location_counts.get(c.id, 0)) for c in rows]
    )


@api_view(["GET"])
def locations(request):
    rows = Location.objects.all().order_by("name")
    return Response([serializers.location_dict(l) for l in rows])


@api_view(["GET"])
def locations_config(request):
    companies = {c.id: c for c in Company.objects.all()}
    user_names = {u.id: u.full_name for u in AppUser.objects.all()}
    rows = Location.objects.all().order_by("name")
    result = []
    for l in rows:
        company = companies.get(l.company_id)
        result.append(
            serializers.location_config_dict(
                l,
                company.name if company else None,
                company.country_code if company else "MY",
                user_names.get(l.principal_contact_user_id),
            )
        )
    return Response(result)


@api_view(["GET"])
def menu(request):
    category = request.query_params.get("category")
    qs = MenuItem.objects.all()
    if category:
        qs = qs.filter(category=category)
    rows = sorted(qs, key=lambda m: serializers.num(m.revenue), reverse=True)
    return Response([serializers.menu_item_dict(m) for m in rows])


@api_view(["GET", "POST"])
def vendors(request):
    if request.method == "GET":
        engaged = request.query_params.get("engaged")
        qs = Vendor.objects.all()
        if engaged is not None:
            qs = qs.filter(engaged=engaged.lower() == "true")
        rows = sorted(qs, key=lambda v: (not v.engaged, (v.name or "").lower()))
        return Response([serializers.vendor_dict(v) for v in rows])

    body = request.data or {}
    external_id = (body.get("externalId") or "").strip().upper()
    name = (body.get("name") or "").strip()
    if not external_id:
        return Response({"message": "Vendor ID is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not name:
        return Response({"message": "Vendor name is required."}, status=status.HTTP_400_BAD_REQUEST)

    if any((v.external_id or "").lower() == external_id.lower() for v in Vendor.objects.all()):
        return Response({"message": "Vendor ID already exists."}, status=status.HTTP_409_CONFLICT)
    if any((v.name or "").lower() == name.lower() for v in Vendor.objects.all()):
        return Response({"message": "Vendor name already exists."}, status=status.HTTP_409_CONFLICT)

    vtype = (body.get("type") or "").strip().lower() or "offline"
    contact_person = (body.get("contactPerson") or "").strip()
    contact_position = (body.get("contactPosition") or "").strip()
    mobile = (body.get("mobile") or "").strip()
    email = (body.get("email") or "").strip()
    contacts_json = json.dumps(
        [
            {
                "name": contact_person,
                "position": contact_position,
                "mobile": mobile,
                "email": email,
                "isDefault": True,
            }
        ]
    )

    vendor = Vendor(
        external_id=external_id,
        name=name,
        type=vtype,
        brn=(body.get("brn") or "").strip(),
        products=(body.get("products") or "").strip(),
        city=(body.get("city") or "").strip(),
        state=(body.get("state") or "").strip(),
        address=(body.get("address") or "").strip(),
        contact_person=contact_person,
        contact_position=contact_position,
        mobile=mobile,
        email=email,
        contacts_json=contacts_json,
        engaged=False,
    )
    vendor.save(force_insert=True)
    return Response(serializers.vendor_dict(vendor))


@api_view(["POST"])
def engage_vendor(request, external_id):
    vendor = Vendor.objects.filter(external_id=external_id).first()
    if vendor is None:
        return Response(status=status.HTTP_404_NOT_FOUND)

    body = request.data or {}
    submitted = body.get("contacts") or []
    contacts = []
    for c in submitted:
        entry = {
            "name": (c.get("name") or "").strip(),
            "position": (c.get("position") or "").strip(),
            "mobile": (c.get("mobile") or "").strip(),
            "email": (c.get("email") or "").strip(),
            "isDefault": bool(c.get("isDefault")),
        }
        if entry["name"] or entry["mobile"] or entry["email"]:
            contacts.append(entry)

    if not contacts:
        contacts.append(
            {
                "name": (vendor.contact_person or "").strip(),
                "position": (vendor.contact_position or "").strip(),
                "mobile": (vendor.mobile or "").strip(),
                "email": (vendor.email or "").strip(),
                "isDefault": True,
            }
        )

    if not any(c["isDefault"] for c in contacts):
        contacts[0]["isDefault"] = True
    else:
        first_default = next(i for i, c in enumerate(contacts) if c["isDefault"])
        for i, c in enumerate(contacts):
            c["isDefault"] = i == first_default

    default_contact = next((c for c in contacts if c["isDefault"]), contacts[0])
    vendor.contacts_json = json.dumps(contacts)
    vendor.contact_person = default_contact["name"]
    vendor.contact_position = default_contact["position"]
    vendor.mobile = default_contact["mobile"]
    vendor.email = default_contact["email"]
    vendor.engaged = True
    vendor.save()
    return Response(serializers.vendor_dict(vendor))


@api_view(["GET"])
def ingredients(request):
    rows = Ingredient.objects.all().order_by("name")
    return Response([serializers.ingredient_dict(i) for i in rows])


def _items_by_order(order_ids):
    grouped = {}
    for item in PurchaseOrderItem.objects.filter(purchase_order_id__in=order_ids):
        grouped.setdefault(item.purchase_order_id, []).append(item)
    return grouped


@api_view(["GET"])
def purchase_orders(request):
    orders = list(PurchaseOrder.objects.all().order_by("-order_date", "-id"))
    grouped = _items_by_order([o.id for o in orders])
    return Response(
        [serializers.purchase_order_dict(o, grouped.get(o.id, [])) for o in orders]
    )


@api_view(["GET"])
def active_purchase_orders(request):
    company_id = request.query_params.get("companyId")
    orders = list(PurchaseOrder.objects.all().order_by("-order_date", "-id"))
    orders = [
        o for o in orders if (o.status or "").lower() != serializers.STATUS_RECONCILED.lower()
    ]
    if company_id:
        cid = int(company_id)
        orders = [o for o in orders if o.company_id is None or o.company_id == cid]
    grouped = _items_by_order([o.id for o in orders])
    return Response(
        [serializers.purchase_order_dict(o, grouped.get(o.id, [])) for o in orders]
    )


@api_view(["GET"])
def vendor_product_prices(request):
    rows = VendorProductPrice.objects.all().order_by("external_id")
    return Response([serializers.vendor_price_dict(p) for p in rows])


@api_view(["GET"])
def inventory_alerts(request):
    rows = InventoryAlert.objects.all().order_by("status")
    return Response([serializers.inventory_alert_dict(a) for a in rows])


@api_view(["GET"])
def revenue(request):
    period = request.query_params.get("period", "week")
    rows = RevenueDataPoint.objects.filter(period=period).order_by("id")
    return Response([serializers.revenue_point_dict(r) for r in rows])


@api_view(["GET"])
def progress(request):
    milestones = list(DevelopmentMilestone.objects.all().order_by("id"))
    total = len(milestones)
    completed = sum(1 for m in milestones if m.status == "completed")
    overall = (
        0 if total == 0 else round(sum(m.progress_percent for m in milestones) / total)
    )
    last_updated = max((m.updated_at for m in milestones), default=None)

    phases = []
    seen = {}
    for m in milestones:
        if m.phase not in seen:
            seen[m.phase] = {"phase": m.phase, "items": []}
            phases.append(seen[m.phase])
        seen[m.phase]["items"].append(
            {
                "id": m.id,
                "title": m.title,
                "status": m.status,
                "progressPercent": m.progress_percent,
                "notes": m.notes,
                "updatedAt": m.updated_at,
            }
        )

    return Response(
        {
            "overallPercent": overall,
            "completedCount": completed,
            "totalCount": total,
            "lastUpdated": last_updated,
            "milestones": phases,
        }
    )
