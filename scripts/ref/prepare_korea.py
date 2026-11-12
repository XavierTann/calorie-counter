"""Builds data/ref/korea.json from Korea MFDS's national dish nutrition data.

Source: 식품의약품안전처_통합식품영양성분정보(음식) (Ministry of Food and Drug Safety, Korea),
https://www.data.go.kr/data/15100070/standard.do  (KOGL Type 1: free to use with attribution).

Usage: python3 scripts/ref/prepare_korea.py <downloaded.csv>
Keeps restaurant and home-cooked dishes (skips school/workplace canteens, franchise menus,
bakery, drinks and dairy) and one row per dish name, preferring lab-analysed values.
"""
import csv
import json
import re
import sys

ORIGIN_PRIORITY = ["외식(분석함량)", "가정식(분석 함량)", "외식(재료량 기반 산출함량)"]
ORIGIN_EN = {
    "외식(분석함량)": "restaurant, lab-analysed",
    "가정식(분석 함량)": "home-cooked, lab-analysed",
    "외식(재료량 기반 산출함량)": "restaurant, calculated from recipe",
}
SKIP_CATEGORIES = {"빵 및 과자류", "음료 및 차류", "유제품류 및 빙과류"}


# Revised Romanization of Hangul, so dishes can be matched from English spellings like "tteokbokki".
INITIALS = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"]
MEDIALS = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"]
FINALS = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"]
# A final consonant moves onto a following vowel-initial syllable (떡볶이 -> tteokbokki).
LIAISON = ["", "g", "kk", "ks", "n", "nj", "nh", "d", "r", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s", "ss", "ng", "j", "ch", "k", "t", "p", "h"]


def romanize(text):
    out = []
    chars = list(text)
    for i, ch in enumerate(chars):
        code = ord(ch) - 0xAC00
        if not 0 <= code < 11172:
            out.append(" " if ch in "_ ()/,·" else ch.lower())
            continue
        ini, med, fin = code // 588, (code % 588) // 28, code % 28
        nxt = ord(chars[i + 1]) - 0xAC00 if i + 1 < len(chars) else -1
        next_vowel_initial = 0 <= nxt < 11172 and nxt // 588 == 11
        prev = out[-1] if out else ""
        start = INITIALS[ini]
        if ini == 11 and prev.startswith("~"):
            start = prev[1:]
            out.pop()
        out.append(start + MEDIALS[med])
        if fin:
            out.append("~" + LIAISON[fin] if next_vowel_initial and fin != 21 else FINALS[fin])
    s = "".join(x[1:] if x.startswith("~") else x for x in out)
    return " ".join(s.split())


def num(v):
    try:
        return float(str(v).strip())
    except ValueError:
        return None


def main(path):
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    best = {}
    for r in rows:
        if r["식품기원명"] not in ORIGIN_PRIORITY or r["식품대분류명"] in SKIP_CATEGORIES:
            continue
        kcal100 = num(r["에너지(kcal)"])
        m = re.match(r"([\d.]+)\s*(g|ml)", r["식품중량"] or "")
        if kcal100 is None or not m:
            continue
        name = r["식품명"].strip()
        rank = ORIGIN_PRIORITY.index(r["식품기원명"])
        if name in best and best[name][0] <= rank:
            continue
        weight = float(m.group(1))
        f = weight / 100
        p100, c100, fat100 = (num(r["단백질(g)"]) or 0, num(r["탄수화물(g)"]) or 0, num(r["지방(g)"]) or 0)
        best[name] = (
            rank,
            {
                "code": r["식품코드"],
                "name_local": name,
                "roman": romanize(name),
                "roman_group": romanize(r["대표식품명"].strip()),
                "group_local": r["대표식품명"].strip(),
                "category_local": r["식품대분류명"],
                "origin": ORIGIN_EN[r["식품기원명"]],
                "serving_amount": round(weight, 1),
                "serving_unit": m.group(2),
                "kcal_100": round(kcal100, 1),
                "kcal": round(kcal100 * f),
                "protein": round(p100 * f, 1),
                "carbs": round(c100 * f, 1),
                "fat": round(fat100 * f, 1),
            },
        )
    out = sorted((v for _, v in best.values()), key=lambda x: x["name_local"])
    json.dump(out, open("data/ref/korea.json", "w"), ensure_ascii=False, indent=0)
    print(f"{len(out)} Korean dishes -> data/ref/korea.json")


if __name__ == "__main__":
    main(sys.argv[1])
