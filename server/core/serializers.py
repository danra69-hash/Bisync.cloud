"""
Plain dict serializers that reproduce the exact JSON shapes returned by the
ASP.NET Core controllers (camelCase keys, numbers cast from TEXT columns).
"""
import json


def num(value):
    """Cast a value (often stored as TEXT by EF Core) to a JSON number."""
    if value is None or value == "":
        return 0
    try:
        f = float(value)
    except (TypeError, ValueError):
        return 0
    return int(f) if f.is_integer() else f


def parse_int_list(raw):
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return [int(x) for x in data] if isinstance(data, list) else []
    except (ValueError, TypeError):
        return []


def parse_str_list(raw):
    if not raw:
        return []
    try:
        data = json.loads(raw)
        return [str(x) for x in data] if isinstance(data, list) else []
    except (ValueError, TypeError):
        return []


def company_dict(c, location_count=0):
    return {
        "id": c.id,
        "name": c.name,
        "brn": c.brn,
        "gstTin": c.gst_tin,
        "countryCode": c.country_code,
        "addressLine1": c.address_line1,
        "addressLine2": c.address_line2,
        "city": c.city,
        "stateProvince": c.state_province,
        "postcode": c.postcode,
        "phone": c.phone,
        "fax": c.fax,
        "email": c.email,
        "active": c.active,
        "locationCount": location_count,
    }


def location_dict(l):
    return {
        "id": l.id,
        "externalId": l.external_id,
        "name": l.name,
        "address": l.address,
        "companyId": l.company_id,
        "addressLine1": l.address_line1,
        "addressLine2": l.address_line2,
        "city": l.city,
        "stateProvince": l.state_province,
        "postcode": l.postcode,
        "principalContactUserId": l.principal_contact_user_id,
        "salesToday": num(l.sales_today),
        "salesWtd": num(l.sales_wtd),
        "salesMtd": num(l.sales_mtd),
        "salesYtd": num(l.sales_ytd),
        "salesPrevToday": num(l.sales_prev_today),
        "salesPrevWtd": num(l.sales_prev_wtd),
        "salesPrevMtd": num(l.sales_prev_mtd),
        "salesPrevYtd": num(l.sales_prev_ytd),
        "coversToday": l.covers_today,
        "coversWtd": l.covers_wtd,
        "coversMtd": l.covers_mtd,
        "coversYtd": l.covers_ytd,
        "coversPrevToday": l.covers_prev_today,
        "coversPrevWtd": l.covers_prev_wtd,
        "coversPrevMtd": l.covers_prev_mtd,
        "coversPrevYtd": l.covers_prev_ytd,
    }


def location_config_dict(l, company_name, country_code, principal_contact_name):
    return {
        "id": l.id,
        "externalId": l.external_id,
        "name": l.name,
        "companyId": l.company_id,
        "companyName": company_name,
        "countryCode": country_code,
        "addressLine1": l.address_line1,
        "addressLine2": l.address_line2,
        "city": l.city,
        "stateProvince": l.state_province,
        "postcode": l.postcode,
        "principalContactUserId": l.principal_contact_user_id,
        "principalContactName": principal_contact_name,
    }


def user_dict(u, companies_by_id, locations_by_id, employee_code=None):
    location_ids = parse_int_list(u.location_ids_json)
    return {
        "id": u.id,
        "employeeId": u.employee_id,
        "employeeCode": employee_code,
        "fullName": u.full_name,
        "email": u.email,
        "role": u.role,
        "phone": u.phone,
        "active": u.active,
        "accessJson": u.access_json,
        "companyId": u.company_id,
        "companyName": companies_by_id.get(u.company_id),
        "locationIds": location_ids,
        "locationNames": [
            locations_by_id[i] for i in location_ids if i in locations_by_id
        ],
        "locationIdsJson": u.location_ids_json,
    }


def menu_item_dict(m):
    return {
        "id": m.id,
        "name": m.name,
        "category": m.category,
        "orders": m.orders,
        "revenue": num(m.revenue),
        "marginPercent": m.margin_percent,
    }


def vendor_dict(v):
    return {
        "id": v.id,
        "externalId": v.external_id,
        "name": v.name,
        "type": v.type,
        "brn": v.brn,
        "products": v.products,
        "city": v.city,
        "state": v.state,
        "contactPerson": v.contact_person,
        "contactPosition": v.contact_position,
        "mobile": v.mobile,
        "email": v.email,
        "address": v.address,
        "contactsJson": v.contacts_json,
        "engaged": v.engaged,
    }


def ingredient_dict(i):
    return {
        "id": i.id,
        "componentId": i.component_id,
        "name": i.name,
        "category": i.category,
        "group": i.group,
        "recipeUom": i.recipe_uom,
        "inventoryUom": i.inventory_uom,
        "lastPriceRecipe": num(i.last_price_recipe),
        "lastPriceInventory": num(i.last_price_inventory),
        "dailyUsage": num(i.daily_usage),
        "orderFreqDays": i.order_freq_days,
        "storageJson": i.storage_json,
        "storageNote": i.storage_note,
        "detailConfigJson": i.detail_config_json,
        "attachedProducts": i.attached_products,
        "attachedVendors": i.attached_vendors,
        "active": i.active,
        "locationsJson": i.locations_json,
    }


def inventory_alert_dict(a):
    return {
        "id": a.id,
        "itemName": a.item_name,
        "stock": a.stock,
        "status": a.status,
        "threshold": a.threshold,
    }


def revenue_point_dict(r):
    return {
        "id": r.id,
        "period": r.period,
        "label": r.label,
        "currentValue": num(r.current_value),
        "priorValue": num(r.prior_value),
        "covers": r.covers,
    }


def vendor_price_dict(p):
    return {
        "id": p.external_id,
        "deliveryPrice": p.delivery_price,
        "updatedAt": p.updated_at,
    }


# --- Purchase order mapping (mirrors PurchaseOrderWorkflow.MapOrder/MapItem) ---

STATUS_PENDING_APPROVAL = "Pending Approval"
STATUS_OPEN = "Open"
STATUS_RECEIVED = "Received"
STATUS_RECONCILED = "Reconciled"
DOC_PR = "PR"
DOC_PO = "PO"


def _is_pending_approval(status):
    return (status or "").strip().lower() == STATUS_PENDING_APPROVAL.lower()


def can_approve(order):
    return _is_pending_approval(order.status)


def can_receive(order):
    if (order.document_type or "").lower() != DOC_PO.lower():
        return False
    status = (order.status or "").strip().lower()
    return status in {"open", "pending", "confirmed", "in transit"}


def can_reconcile(order):
    return (order.document_type or "").lower() == DOC_PO.lower() and (
        order.status or ""
    ).strip().lower() == STATUS_RECEIVED.lower()


def purchase_order_item_dict(item):
    return {
        "id": item.id,
        "componentId": item.component_id,
        "componentName": item.component_name or item.name,
        "vendorProductId": item.vendor_product_id,
        "name": item.name,
        "quantity": num(item.quantity),
        "unitPrice": num(item.unit_price),
        "issuedUnitPrice": item.issued_unit_price
        if item.issued_unit_price and item.issued_unit_price > 0
        else num(item.unit_price),
        "unit": item.unit,
        "componentUom": item.component_uom,
        "deliveryPackage": item.delivery_package,
        "receivedQuantity": item.received_quantity,
        "receivedUnitPrice": item.received_unit_price,
        "reconciledQuantity": item.reconciled_quantity,
        "reconciledUnitPrice": item.reconciled_unit_price,
        "taxAmount": item.tax_amount,
    }


def purchase_order_dict(order, items):
    document_type = DOC_PR if _is_pending_approval(order.status) else order.document_type
    return {
        "id": order.id,
        "poNumber": order.po_number,
        "vendorName": order.vendor_name,
        "orderDate": order.order_date,
        "deliveryDate": order.delivery_date,
        "documentType": document_type,
        "status": (order.status or "").strip(),
        "companyId": order.company_id,
        "locationExternalIds": parse_str_list(order.location_ids_json),
        "initiatedBy": order.initiated_by,
        "approvedBy": order.approved_by,
        "approvedAt": order.approved_at,
        "receivedAt": order.received_at,
        "reconciledAt": order.reconciled_at,
        "vendorShareToken": order.vendor_share_token,
        "vendorAcceptedAt": order.vendor_accepted_at,
        "vendorAcceptedBy": order.vendor_accepted_by,
        "canApprove": can_approve(order),
        "canReceive": can_receive(order),
        "canReconcile": can_reconcile(order),
        "items": [purchase_order_item_dict(i) for i in items],
    }
