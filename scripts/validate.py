import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
data = json.load(open(ROOT / "data" / "sessions.json"))
sessions = data["sessions"]

print(f"Total sessions: {len(sessions)}\n")

print("=== Distance check (printed vs summed) ===")
bad = 0
for s in sessions:
    printed = s.get("total_distance") or 0
    summed = s.get("summed_distance") or 0
    # free-text sets legitimately don't sum; only flag big gaps with no free set
    has_free = any(it["type"] == "free" for b in s["blocks"] for it in b["items"])
    if printed and abs(printed - summed) > 50 and not has_free:
        bad += 1
        print(f"  MISMATCH {s['id']}: printed={printed} summed={summed} "
              f"blocks={len(s['blocks'])} free={has_free}")
print(f"  ({bad} mismatches without free-text sets)\n")

print("=== Sessions with very few sets (possible parse gaps) ===")
for s in sessions:
    n = sum(len([i for i in b['items'] if i['type']=='set']) for b in s['blocks'])
    if n < 3:
        print(f"  {s['id']} phase={s['phase']} sets={n} dist={s.get('total_distance')}")
print()

print("=== Category distribution ===")
from collections import Counter
cats = Counter()
for s in sessions:
    for c in s["categories"]:
        cats[c] += 1
    if not s["categories"]:
        cats["(none)"] += 1
for c, n in cats.most_common():
    print(f"  {c}: {n}")
print()

print("=== Phase distribution ===")
ph = Counter(s["phase"] for s in sessions)
for p, n in ph.most_common():
    print(f"  {p}: {n}")
print()

print("=== Sessions per date (dupes should be merged) ===")
from collections import defaultdict
bydate = defaultdict(list)
for s in sessions:
    bydate[s["date_iso"]].append(s["day_label"])
for d in sorted(bydate):
    print(f"  {d}: {bydate[d]}")
