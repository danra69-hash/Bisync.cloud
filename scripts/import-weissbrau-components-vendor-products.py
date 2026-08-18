#!/usr/bin/env python3
"""Import Weissbrau components + vendor-product tags from Combined Vendor Product Report.

Creates/updates:
  - Ingredients (Category, Group, API Component ID, Name, Component UOM, Inventory UOM, Conversion 1)
  - Vendor product catalog rows (Vendor Product ID, Name, Delivery Unit, Delivery Price)
  - Tags catalog products onto components via detailConfigJson

Excel Component ID is stored in storageNote for reference; Bisync assigns WEIS-**** IDs.
All rows remain editable in the UI after import.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

try:
    import openpyxl
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl", "-q"])
    import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "weissbrau-combined-vendor-product-report.xlsx"
API = "https://bisync-cloud-389272498937.asia-southeast1.run.app"
COMPANY_ID = 5
LOCATION_IDS = ["weissbrau-pavilion-kuala-lumpur"]

UOM_MAP = {
    "MG": "mg",
    "GR": "g",
    "G": "g",
    "GRAM": "g",
    "GRAMS": "g",
    "KG": "kg",
    "KILO": "kg",
    "TONNE": "t",
    "ML": "ml",
    "CL": "cl",
    "LTR": "L",
    "L": "L",
    "LITRE": "L",
    "LITER": "L",
    "EACH": "pcs",
    "PCS": "pcs",
    "PC": "pcs",
    "NOS": "pcs",
    "UNIT": "unit",
    "BTL": "btl",
    "BOTTLE": "btl",
    "CAN": "can",
    "TIN": "tin",
    "SLICE": "slice",
    "PACK": "pack",
    "PKT": "pkt",
    "BAG": "bag",
    "BOX": "box",
    "CTN": "ctn",
    "CASE": "case",
    "TUB": "tub",
    "ROLL": "roll",
    "SET": "set",
    "PTN": "ptn",
    "CRATE": "crate",
    "KEG": "keg",
}


def clean_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            value = int(value)
        else:
            value = f"{value}".rstrip("0").rstrip(".") if "." in f"{value}" else str(value)
    text = str(value).strip()
    if not text or text.upper() == "NULL":
        return ""
    return text


def normalize_component_name(raw: str) -> str:
    """Mirror ComponentIdentityRules.NormalizeName + ASCII fold for accents.

    Also collapses spaced dashes so names match AllowedNameRegex
    ^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$
    """
    import unicodedata

    folded = "".join(
        ch for ch in unicodedata.normalize("NFKD", raw) if not unicodedata.combining(ch)
    )
    cleaned: list[str] = []
    previous_was_space = False
    for ch in folded.strip():
        if ("A" <= ch <= "Z") or ("a" <= ch <= "z") or ch.isdigit() or ch == "-":
            cleaned.append(ch)
            previous_was_space = False
        elif ch.isspace():
            if previous_was_space or not cleaned:
                continue
            cleaned.append(" ")
            previous_was_space = True
    name = "".join(cleaned).strip()
    # "MEAT - LAGRIMA" is invalid (space then dash); collapse to "MEAT-LAGRIMA".
    name = re.sub(r"\s*-\s*", "-", name)
    name = re.sub(r"\s+", " ", name).strip(" -")
    return name


def to_api_uom(raw: str) -> str:
    text = clean_text(raw).upper()
    if not text:
        return "pcs"
    return UOM_MAP.get(text, text.lower())


def parse_number(value, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    if isinstance(value, (int, float)):
        return float(value)
    text = clean_text(value).replace(",", "")
    try:
        return float(text)
    except ValueError:
        return default


def parse_delivery_unit(raw: str) -> dict:
    """Parse strings like '1.00CTN / 24.00CAN / 320.00ML' or '1.00KG'."""
    text = clean_text(raw)
    segments = [s.strip() for s in text.split("/") if s.strip()] if text else []
    parsed: list[tuple[float, str]] = []
    for seg in segments:
        m = re.match(r"^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$", seg.replace(" ", ""))
        if not m:
            m = re.match(r"^(\d+(?:\.\d+)?)\s*([A-Za-z]+)$", seg)
        if not m:
            continue
        qty = float(m.group(1))
        unit = to_api_uom(m.group(2))
        if qty > 0 and unit:
            parsed.append((qty, unit))

    if not parsed:
        return {
            "orderUnit": "unit",
            "orderQty": 1,
            "packUnit": "unit",
            "packQty": 1,
            "unitUnit": "",
            "unitQty": 0,
        }

    order_qty, order_unit = parsed[0]
    pack_qty, pack_unit = parsed[1] if len(parsed) > 1 else (1.0, order_unit)
    unit_qty, unit_unit = parsed[2] if len(parsed) > 2 else (0.0, "")
    return {
        "orderUnit": order_unit,
        "orderQty": order_qty,
        "packUnit": pack_unit,
        "packQty": pack_qty,
        "unitUnit": unit_unit,
        "unitQty": unit_qty,
    }


def api_json(method: str, path: str, payload: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body) if body else None
        except json.JSONDecodeError:
            parsed = {"message": body}
        return err.code, parsed


def empty_detail_config() -> dict:
    return {
        "altRecipeUnits": [],
        "altInventoryUnits": [],
        "convertFromInventoryQty": "1",
        "convertToRecipeQty": "1",
        "taggedVendorProductIds": [],
        "vendorProductPrincipalQty": {},
        "vendorProductLossYield": {},
        "vendorProductComponentUom": {},
        "vendorProductLocations": {},
        "vendor": "",
        "vendorProduct": "",
        "deliveryUnitPrice": "",
        "expiryPeriodDays": "",
        "splitUse": {
            "enabled": False,
            "componentQty": "1",
            "qtyBasis": "inventory",
            "lines": [],
        },
    }


def parse_detail(raw: str | None) -> dict:
    cfg = empty_detail_config()
    if not raw or not str(raw).strip() or str(raw).strip() == "{}":
        return cfg
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return cfg
    if not isinstance(parsed, dict):
        return cfg
    cfg.update(parsed)
    cfg["taggedVendorProductIds"] = list(parsed.get("taggedVendorProductIds") or [])
    cfg["vendorProductPrincipalQty"] = dict(parsed.get("vendorProductPrincipalQty") or {})
    cfg["vendorProductLossYield"] = dict(parsed.get("vendorProductLossYield") or {})
    cfg["vendorProductComponentUom"] = dict(parsed.get("vendorProductComponentUom") or {})
    cfg["vendorProductLocations"] = dict(parsed.get("vendorProductLocations") or {})
    if not isinstance(cfg.get("splitUse"), dict):
        cfg["splitUse"] = empty_detail_config()["splitUse"]
    return cfg


def make_vendor_product_id(raw_id: str, vendor_name: str, product_name: str, index: int) -> str:
    text = clean_text(raw_id).upper()
    if text:
        return re.sub(r"[^A-Z0-9\-]", "", text)[:50] or f"WEIS-VP{index:04d}"
    base = re.sub(r"[^A-Z0-9]", "", f"{vendor_name}{product_name}".upper())[:40]
    return (f"WEIS-VP-{base}" if base else f"WEIS-VP{index:04d}")[:50]


def load_rows():
    if not XLSX.exists():
        raise SystemExit(f"Missing {XLSX}")
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    header = [clean_text(h) for h in rows[0]]
    expected = [
        "Category",
        "Group",
        "Component ID",
        "Component Name",
        "Component UOM",
        "Inventory UOM",
        "Conversion 1",
        "Inv Unit 2",
        "Conversion 2",
        "Inv Unit 3",
        "Conversion 3",
        "Vendor Name",
        "Vendor Product Name",
        "Vendor Product ID",
        "Delivery Unit",
        "Delivery Price",
    ]
    if header[:16] != expected:
        raise SystemExit(f"Unexpected header: {header}")

    out = []
    for i, row in enumerate(rows[1:], start=1):
        name_raw = clean_text(row[3] if len(row) > 3 else "")
        if not name_raw:
            continue
        name = normalize_component_name(name_raw)
        if not name:
            print(f"skip row {i}: name empty after normalize ({name_raw!r})")
            continue
        out.append(
            {
                "index": i,
                "category": clean_text(row[0])[:100] or "Uncategorized",
                "group": clean_text(row[1])[:100] or "General",
                "legacyComponentId": clean_text(row[2])[:50],
                "name": name[:200],
                "recipeUom": to_api_uom(row[4] if len(row) > 4 else ""),
                "inventoryUom": to_api_uom(row[5] if len(row) > 5 else ""),
                "conversion1": parse_number(row[6] if len(row) > 6 else None, 1.0) or 1.0,
                "vendorName": clean_text(row[11] if len(row) > 11 else ""),
                "vendorProductName": clean_text(row[12] if len(row) > 12 else "")[:300] or name,
                "vendorProductIdRaw": clean_text(row[13] if len(row) > 13 else ""),
                "deliveryUnit": clean_text(row[14] if len(row) > 14 else ""),
                "deliveryPrice": parse_number(row[15] if len(row) > 15 else None, 0.0),
            }
        )
    return out


def ingredient_payload(base: dict, detail: dict, existing: dict | None = None) -> dict:
    conv = base["conversion1"]
    inv_price = 0.0
    delivery = parse_delivery_unit(base["deliveryUnit"])
    if delivery["orderUnit"].lower() == base["inventoryUom"].lower() and base["deliveryPrice"] > 0:
        inv_price = base["deliveryPrice"]
    recipe_price = (inv_price / conv) if conv > 0 and inv_price > 0 else 0.0

    note = f"Source Component ID: {base['legacyComponentId']}" if base["legacyComponentId"] else ""
    if existing and existing.get("storageNote") and "Source Component ID:" not in existing.get("storageNote", ""):
        # Keep prior note and append source id once.
        prior = existing.get("storageNote") or ""
        note = f"{prior} | {note}".strip(" |") if note else prior

    return {
        "id": existing["id"] if existing else 0,
        "companyId": COMPANY_ID,
        "componentId": existing["componentId"] if existing else "",
        "name": base["name"],
        "category": base["category"],
        "group": base["group"],
        "recipeUom": base["recipeUom"],
        "inventoryUom": base["inventoryUom"],
        "lastPriceRecipe": recipe_price if not existing else existing.get("lastPriceRecipe", 0) or recipe_price,
        "lastPriceInventory": inv_price if not existing else existing.get("lastPriceInventory", 0) or inv_price,
        "dailyUsage": existing.get("dailyUsage", 0) if existing else 0,
        "orderFreqDays": existing.get("orderFreqDays", 0) if existing else 0,
        "parStock": existing.get("parStock", 0) if existing else 0,
        "parStockUom": base["recipeUom"],
        "onHandQty": existing.get("onHandQty", 0) if existing else 0,
        "metricsLookbackDays": existing.get("metricsLookbackDays", 90) if existing else 90,
        "dailyUsageAuto": existing.get("dailyUsageAuto", False) if existing else False,
        "orderFreqAuto": existing.get("orderFreqAuto", False) if existing else False,
        "storageJson": existing.get("storageJson") if existing else json.dumps(["Dry Store"]),
        "storageNote": note,
        "detailConfigJson": json.dumps(detail),
        "attachedProducts": existing.get("attachedProducts", 0) if existing else 0,
        "attachedVendors": len(detail.get("taggedVendorProductIds") or []),
        "active": True,
        "locationsJson": json.dumps(LOCATION_IDS),
    }


def main() -> int:
    rows = load_rows()
    print(f"Loaded {len(rows)} product rows from {XLSX.name}")

    status, vendors = api_json("GET", "/api/vendors")
    if status != 200 or not isinstance(vendors, list):
        raise SystemExit(f"Failed to list vendors: {status} {vendors}")
    vendors_by_name = {clean_text(v.get("name")).upper(): v for v in vendors}

    status, ingredients = api_json("GET", f"/api/ingredients?companyId={COMPANY_ID}")
    if status != 200 or not isinstance(ingredients, list):
        raise SystemExit(f"Failed to list ingredients: {status} {ingredients}")
    ingredients_by_name = {
        normalize_component_name(i.get("name", "")).lower(): i for i in ingredients
    }

    status, catalog = api_json("GET", "/api/vendorproducts/catalog")
    if status != 200 or not isinstance(catalog, list):
        raise SystemExit(f"Failed to list catalog: {status} {catalog}")
    catalog_by_id = {(c.get("id") or "").upper(): c for c in catalog}

    by_component: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        key = row["legacyComponentId"] or row["name"].upper()
        by_component[key].append(row)

    created_components = updated_components = 0
    created_products = updated_products = 0
    tagged = failed = skipped_vendor = 0

    for idx, (legacy_id, group_rows) in enumerate(by_component.items(), start=1):
        base = group_rows[0]
        existing = ingredients_by_name.get(base["name"].lower())

        # Ensure all vendor products exist first, collect tag ids.
        tag_ids: list[str] = []
        primary_vendor = ""
        primary_product = ""
        primary_price = ""

        for row in group_rows:
            vendor = vendors_by_name.get(row["vendorName"].upper())
            if vendor is None:
                print(f"  missing vendor: {row['vendorName']}")
                skipped_vendor += 1
                continue

            vp_id = make_vendor_product_id(
                row["vendorProductIdRaw"],
                row["vendorName"],
                row["vendorProductName"],
                row["index"],
            )
            delivery = parse_delivery_unit(row["deliveryUnit"])
            payload = {
                "id": vp_id,
                "vendorExternalId": vendor["externalId"],
                "vendorName": vendor["name"],
                "productName": row["vendorProductName"],
                "group": row["group"],
                "specification": "",
                "deliveryPrice": row["deliveryPrice"],
                "deliveryJson": json.dumps(delivery),
                "productPolicyTag": "non-halal",
                "isPrivate": False,
                "privateLocationIds": [],
                "active": True,
            }

            if vp_id in catalog_by_id:
                status, result = api_json("PUT", f"/api/vendorproducts/catalog/{urllib.parse.quote(vp_id)}", payload)
                if status != 200:
                    print(f"  update catalog failed {vp_id}: {status} {result}")
                    failed += 1
                    continue
                updated_products += 1
            else:
                status, result = api_json("POST", "/api/vendorproducts/catalog", payload)
                if status == 409:
                    status, result = api_json(
                        "PUT",
                        f"/api/vendorproducts/catalog/{urllib.parse.quote(vp_id)}",
                        payload,
                    )
                    if status != 200:
                        print(f"  conflict-update catalog failed {vp_id}: {status} {result}")
                        failed += 1
                        continue
                    updated_products += 1
                elif status not in (200, 201):
                    print(f"  create catalog failed {vp_id}: {status} {result}")
                    failed += 1
                    continue
                else:
                    created_products += 1
                catalog_by_id[vp_id] = result or payload

            tag_ids.append(vp_id)
            if not primary_vendor:
                primary_vendor = vendor["name"]
                primary_product = row["vendorProductName"]
                primary_price = str(row["deliveryPrice"]) if row["deliveryPrice"] else ""

        if not tag_ids:
            print(f"skip component {base['name']}: no vendor products")
            continue

        detail = parse_detail(existing.get("detailConfigJson") if existing else None)
        # Replace conversion from this import; merge tags.
        detail["convertFromInventoryQty"] = "1"
        detail["convertToRecipeQty"] = (
            str(int(base["conversion1"]))
            if float(base["conversion1"]).is_integer()
            else str(base["conversion1"])
        )
        merged_tags = list(dict.fromkeys([*(detail.get("taggedVendorProductIds") or []), *tag_ids]))
        detail["taggedVendorProductIds"] = merged_tags
        for vp_id in tag_ids:
            detail["vendorProductPrincipalQty"][vp_id] = "1"
            detail["vendorProductLossYield"][vp_id] = "0"
            detail["vendorProductComponentUom"][vp_id] = base["recipeUom"]
            detail["vendorProductLocations"][vp_id] = list(LOCATION_IDS)
        detail["vendor"] = primary_vendor
        detail["vendorProduct"] = primary_product
        detail["deliveryUnitPrice"] = primary_price

        payload = ingredient_payload(base, detail, existing)
        if existing:
            status, result = api_json("PUT", f"/api/ingredients/{existing['id']}", payload)
            if status != 200:
                print(f"  update ingredient failed {base['name']}: {status} {result}")
                failed += 1
                continue
            updated_components += 1
            ingredients_by_name[base["name"].lower()] = result
        else:
            status, result = api_json("POST", "/api/ingredients", payload)
            if status == 409:
                # Race / pre-existing: refresh list entry by name if possible.
                print(f"  create conflict for {base['name']}, skipping create")
                failed += 1
                continue
            if status not in (200, 201):
                print(f"  create ingredient failed {base['name']}: {status} {result}")
                failed += 1
                continue
            created_components += 1
            ingredients_by_name[base["name"].lower()] = result

        tagged += len(tag_ids)
        if idx % 25 == 0 or idx == len(by_component):
            print(
                f"[{idx}/{len(by_component)}] components+ "
                f"{created_components} upd {updated_components} | "
                f"products+ {created_products} upd {updated_products} | tags {tagged} fail {failed}"
            )
        # Light pacing for Cloud Run.
        if idx % 50 == 0:
            time.sleep(0.2)

    print(
        "Done.",
        f"components created={created_components} updated={updated_components}",
        f"products created={created_products} updated={updated_products}",
        f"tags={tagged} skipped_vendor={skipped_vendor} failed={failed}",
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
