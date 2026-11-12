"""Builds data/ref/india.json from the Indian Nutrient Databank (INDB).

Source: Vijayakumar et al., "Development of an Indian Food Composition Database",
Current Developments in Nutrition (2024); data at
https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-

Usage: python3 scripts/ref/prepare_india.py <INDB.xlsx> <recipes_servingsize.xlsx>
Needs: pip install openpyxl. Keeps the recipes (not raw ingredients), minus rows with
implausible values (see MAX_SERVING_G and MAX_FAT_PER_100G).
"""
import json
import re
import sys

import openpyxl


MAX_SERVING_G = 450
# INDB counts all deep-frying oil as eaten, so fried recipes come out at ~700-800 kcal/100 g.
# Rows above this fat level are left out (the AI estimates them instead).
MAX_FAT_PER_100G = 30


def sheet_rows(path):
    ws = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    header = next(it)
    for row in it:
        yield dict(zip(header, row))


def main(indb_path, serving_path):
    servings = {r["recipe_code"]: r for r in sheet_rows(serving_path) if r.get("recipe_code")}
    out = []
    for r in sheet_rows(indb_path):
        code = r.get("food_code")
        s = servings.get(code)
        if not s or r.get("unit_serving_energy_kcal") is None:
            continue
        if float(r["fat_g"] or 0) > MAX_FAT_PER_100G:
            continue
        name = re.sub(r"\s+", " ", str(r["food_name"])).strip()
        size = s.get("size_of_servings") or 1
        unit = (s.get("servings_unit") or "serving").strip()
        kcal100 = float(r["energy_kcal"] or 0)
        kcal_serving = float(r["unit_serving_energy_kcal"])
        grams = kcal_serving / kcal100 * 100 if kcal100 else 0
        if 0 < grams <= MAX_SERVING_G:
            row = {
                "serving": f"{size:g} {unit} (~{grams:.0f} g)",
                "kcal": round(kcal_serving),
                "protein": round(float(r["unit_serving_protein_g"] or 0), 1),
                "carbs": round(float(r["unit_serving_carb_g"] or 0), 1),
                "fat": round(float(r["unit_serving_fat_g"] or 0), 1),
            }
        else:
            # The source's serving size implies an impossible weight (e.g. a 1 kg "bowl"); fall back to per 100 g.
            row = {
                "serving": "100 g",
                "kcal": round(kcal100),
                "protein": round(float(r["protein_g"] or 0), 1),
                "carbs": round(float(r["carb_g"] or 0), 1),
                "fat": round(float(r["fat_g"] or 0), 1),
            }
        out.append({"code": code, "name": name, "kcal_100": round(kcal100, 1), **row})
    out.sort(key=lambda x: x["name"].lower())
    json.dump(out, open("data/ref/india.json", "w"), ensure_ascii=False, indent=0)
    print(f"{len(out)} Indian recipes -> data/ref/india.json")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
