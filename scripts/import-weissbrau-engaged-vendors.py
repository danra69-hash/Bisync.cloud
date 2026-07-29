#!/usr/bin/env python3
"""Import Weissbrau engaged vendors from data/weissbrau-engaged-vendors.xlsx into the live API."""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import openpyxl
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl", "-q"])
    import openpyxl

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "weissbrau-engaged-vendors.xlsx"
API = "https://bisync-cloud-389272498937.asia-southeast1.run.app"
COMPANY_ID = 5
LOCATION_IDS = ["weissbrau-pavilion-kuala-lumpur"]
REQUESTED_BY = "weissbrau-vendor-import"


def clean_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        if value.is_integer():
            value = int(value)
        else:
            value = str(value)
    text = str(value).strip()
    if not text or text.upper() == "NULL":
        return ""
    return text


def clean_phone(value) -> str:
    text = clean_text(value)
    if not text:
        return ""
    # Excel sometimes yields negative integers for corrupted phone cells.
    if re.fullmatch(r"-?\d+(\.0+)?", text):
        number = int(float(text))
        if number <= 0:
            return ""
        text = str(number)
    text = re.sub(r"[^\d+]", "", text)
    return text[:30]


def clean_email(value) -> str:
    text = clean_text(value)
    if not text or "@" not in text:
        return ""
    return text[:256]


def parse_city_state_postcode(address: str) -> tuple[str, str, str]:
    if not address:
        return "", "", ""
    parts = [p.strip() for p in address.split(",") if p.strip()]
    postcode_match = re.search(r"\b(\d{5})\b", address)
    postcode = postcode_match.group(1) if postcode_match else ""
    # Typical: ..., City, State, Postcode Country
    if len(parts) >= 3 and re.search(r"malaysia", parts[-1], re.I):
        state = re.sub(r"\b\d{5}\b", "", parts[-2]).strip() or parts[-2]
        city = parts[-3]
        return city[:100], state[:100], postcode[:30]
    if len(parts) >= 2:
        return parts[-2][:100], parts[-1][:100], postcode[:30]
    return "", "", postcode[:30]


def make_external_id(brn: str, index: int) -> str:
    raw = re.sub(r"[^A-Za-z0-9]", "", brn).upper()
    if raw:
        candidate = f"WEIS-{raw}"[:50]
        return candidate
    return f"WEIS-V{index:03d}"


def api_json(method: str, path: str, payload: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body) if body else None
        except json.JSONDecodeError:
            parsed = {"message": body}
        return err.code, parsed


def load_rows():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    header = [clean_text(h) for h in rows[0]]
    expected = ["VendorName", "NewBRN", "OldBRN", "Address", "TelNo", "FaxNo", "Email"]
    if header[:7] != expected:
        raise SystemExit(f"Unexpected header: {header}")
    out = []
    for i, row in enumerate(rows[1:], start=1):
        name = clean_text(row[0] if len(row) > 0 else "")
        if not name:
            continue
        brn = clean_text(row[1] if len(row) > 1 else "") or clean_text(row[2] if len(row) > 2 else "")
        address = clean_text(row[3] if len(row) > 3 else "")
        phone = clean_phone(row[4] if len(row) > 4 else "")
        email = clean_email(row[6] if len(row) > 6 else "")
        city, state, postcode = parse_city_state_postcode(address)
        out.append(
            {
                "index": i,
                "name": name[:200],
                "brn": brn[:50],
                "address": address[:400],
                "city": city,
                "state": state,
                "postcode": postcode,
                "mobile": phone,
                "email": email,
            }
        )
    return out


def main() -> int:
    if not XLSX.exists():
        raise SystemExit(f"Missing {XLSX}")

    rows = load_rows()
    print(f"Loaded {len(rows)} vendors from {XLSX.name}")

    status, existing = api_json("GET", "/api/vendors")
    if status != 200 or not isinstance(existing, list):
        raise SystemExit(f"Failed to list vendors: {status} {existing}")
    by_name = {v.get("name", "").strip().lower(): v for v in existing}
    by_ext = {v.get("externalId", "").strip().upper(): v for v in existing}

    created = updated = engaged = skipped = failed = 0
    used_ids: set[str] = set(by_ext)

    for row in rows:
        ext = make_external_id(row["brn"], row["index"])
        base = ext
        n = 2
        while ext in used_ids and by_ext.get(ext, {}).get("name", "").strip().lower() != row["name"].lower():
            suffix = f"-{n}"
            ext = (base[: 50 - len(suffix)] + suffix).upper()
            n += 1
        used_ids.add(ext)

        contact_name = "To be advised"
        contact_mobile = row["mobile"]
        contact_email = row["email"]

        payload = {
            "companyId": COMPANY_ID,
            "externalId": ext,
            "name": row["name"],
            "type": "offline",
            "brn": row["brn"],
            "products": "",
            "city": row["city"],
            "state": row["state"],
            "postcode": row["postcode"],
            "address": row["address"],
            "contactPerson": contact_name,
            "contactPosition": "",
            "mobile": contact_mobile,
            "email": contact_email,
            "productPolicyTag": "non-halal",
            "allowPartialDelivery": False,
            "engagedLocationIds": LOCATION_IDS,
        }

        existing_row = by_name.get(row["name"].lower())
        vendor = None
        if existing_row:
            ext = existing_row["externalId"]
            status, vendor = api_json("PUT", f"/api/vendors/{urllib.parse.quote(ext)}", {
                "name": row["name"],
                "type": "offline",
                "brn": row["brn"] or existing_row.get("brn") or "",
                "products": existing_row.get("products") or "",
                "city": row["city"] or existing_row.get("city") or "",
                "state": row["state"] or existing_row.get("state") or "",
                "postcode": row["postcode"] or existing_row.get("postcode") or "",
                "address": row["address"] or existing_row.get("address") or "",
                "contactPerson": contact_name,
                "contactPosition": existing_row.get("contactPosition") or "",
                "mobile": contact_mobile or existing_row.get("mobile") or "",
                "email": contact_email or existing_row.get("email") or "",
                "productPolicyTag": existing_row.get("productPolicyTag") or "non-halal",
                "allowPartialDelivery": bool(existing_row.get("allowPartialDelivery")),
                "engagedLocationIds": LOCATION_IDS,
            })
            if status != 200:
                print(f"FAIL update {row['name']}: {status} {vendor}")
                failed += 1
                continue
            updated += 1
        else:
            status, vendor = api_json("POST", "/api/vendors", payload)
            if status == 409:
                # Retry with numeric suffix if ID collision.
                ext = f"WEIS-V{row['index']:03d}"
                payload["externalId"] = ext
                status, vendor = api_json("POST", "/api/vendors", payload)
            if status != 200:
                print(f"FAIL create {row['name']}: {status} {vendor}")
                failed += 1
                continue
            created += 1
            by_ext[ext] = vendor
            by_name[row["name"].lower()] = vendor

        if vendor and vendor.get("engaged"):
            skipped += 1
            continue

        engage_payload = {
            "requestedBy": REQUESTED_BY,
            "contacts": [
                {
                    "name": contact_name,
                    "position": "",
                    "mobile": contact_mobile,
                    "email": contact_email,
                    "isDefault": True,
                }
            ],
        }
        status, engaged_row = api_json(
            "POST",
            f"/api/vendors/{urllib.parse.quote(vendor['externalId'])}/engage",
            engage_payload,
        )
        if status != 200:
            print(f"FAIL engage {row['name']}: {status} {engaged_row}")
            failed += 1
            continue
        engaged += 1
        print(f"OK {vendor['externalId']} · {row['name']}")

    print(
        f"Done. created={created} updated={updated} engaged={engaged} "
        f"alreadyEngaged={skipped} failed={failed}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
