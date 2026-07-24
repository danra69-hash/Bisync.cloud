#!/usr/bin/env python3
"""Regenerate client/public/data/fndds-nutrients-2021-2023.json from USDA FNDDS At A Glance Excel files.

Downloads:
  - 2021-2023 FNDDS At A Glance - Ingredient Nutrient Values.xlsx
  - 2021-2023 FNDDS At A Glance - FNDDS Nutrient Values.xlsx

Usage:
  python3 scripts/build-fndds-nutrient-catalog.py
"""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "client" / "public" / "data" / "fndds-nutrients-2021-2023.json"
CACHE = Path("/tmp/fndds")

URLS = {
    "ingredient": "https://www.ars.usda.gov/ARSUserFiles/80400530/apps/2021-2023%20FNDDS%20At%20A%20Glance%20-%20Ingredient%20Nutrient%20Values.xlsx",
    "food": "https://www.ars.usda.gov/ARSUserFiles/80400530/apps/2021-2023%20FNDDS%20At%20A%20Glance%20-%20FNDDS%20Nutrient%20Values.xlsx",
}

KEY = {
    208: "energyKcal",
    203: "proteinG",
    205: "carbG",
    269: "sugarsG",
    291: "fiberG",
    204: "fatG",
    307: "sodiumMg",
    601: "cholesterolMg",
    606: "satFatG",
}


def normalize(name: str) -> str:
    s = (name or "").lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    print(f"Downloading {url}")
    urllib.request.urlretrieve(url, dest)
    return dest


def main() -> None:
    ing_path = download(URLS["ingredient"], CACHE / "ingredient_nutrient_values.xlsx")
    food_path = download(URLS["food"], CACHE / "fndds_nutrient_values.xlsx")

    ing = pd.read_excel(ing_path, sheet_name="Ingredient Nutrient Values", header=1)
    sub = ing[ing["Nutrient code"].isin(KEY.keys())].copy()
    pivot = (
        sub.pivot_table(
            index=["Ingredient code", "Ingredient description"],
            columns="Nutrient code",
            values="Nutrient value",
            aggfunc="first",
        )
        .rename(columns=KEY)
        .reset_index()
    )

    food = pd.read_excel(food_path, sheet_name="FNDDS Nutrient Values", header=1)
    colmap = {}
    for c in food.columns:
        cl = str(c).replace("\n", " ").strip().lower()
        if cl == "food code":
            colmap[c] = "code"
        elif cl == "main food description":
            colmap[c] = "name"
        elif "energy" in cl:
            colmap[c] = "energyKcal"
        elif cl.startswith("protein"):
            colmap[c] = "proteinG"
        elif "carbohydrate" in cl:
            colmap[c] = "carbG"
        elif "sugars, total" in cl:
            colmap[c] = "sugarsG"
        elif "fiber, total" in cl:
            colmap[c] = "fiberG"
        elif cl.startswith("total fat"):
            colmap[c] = "fatG"
        elif cl.startswith("cholesterol"):
            colmap[c] = "cholesterolMg"
        elif cl.startswith("sodium"):
            colmap[c] = "sodiumMg"
    food2 = food.rename(columns=colmap)
    if "satFatG" not in food2.columns:
        for c in food.columns:
            if "fatty acids, total saturated" in str(c).replace("\n", " ").lower():
                food2["satFatG"] = food[c]
                break

    entries = []
    seen = set()

    def add(kind: str, code, name: str, row) -> None:
        n = normalize(name)
        if not n or n in seen:
            return
        seen.add(n)

        def num(key: str) -> float:
            v = row.get(key)
            try:
                if pd.isna(v):
                    return 0.0
                return float(v)
            except Exception:
                return 0.0

        entries.append(
            {
                "k": kind,
                "c": str(code),
                "n": name.strip(),
                "e": round(num("energyKcal"), 2),
                "p": round(num("proteinG"), 3),
                "cb": round(num("carbG"), 3),
                "sg": round(num("sugarsG"), 3),
                "fb": round(num("fiberG"), 3),
                "ft": round(num("fatG"), 3),
                "sf": round(num("satFatG"), 3),
                "na": round(num("sodiumMg"), 2),
                "ch": round(num("cholesterolMg"), 2),
            }
        )

    for _, r in pivot.iterrows():
        add("i", int(r["Ingredient code"]), str(r["Ingredient description"]), r)
    for _, r in food2.iterrows():
        code = "" if pd.isna(r.get("code")) else int(r["code"])
        add("f", code, str(r["name"]), r)

    payload = {
        "source": "USDA FNDDS 2021-2023 At A Glance (Ingredient Nutrient Values + FNDDS Nutrient Values)",
        "citation": "U.S. Department of Agriculture, Agricultural Research Service. 2024. USDA Food and Nutrient Database for Dietary Studies 2021-2023.",
        "basis": "per 100 g edible portion",
        "count": len(entries),
        "entries": entries,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes, {len(entries)} entries)")


if __name__ == "__main__":
    main()
