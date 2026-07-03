"""
Extract Durham Uni swimming session plans from the coach's PDF exports into a
single sessions.json used by the static site.

Each PDF page == one training session. The tables are exported with a very
regular structure; we parse them semantically (by trailing-column position)
so the small layout differences between sheets don't break parsing.

Sessions are deduplicated by (squad, date, day-label): the same session often
appears in more than one PDF (re-exports / overlapping week bundles). We keep
the richest copy and record every source file it came from.

Run:  ./.venv/bin/python scripts/extract.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "source_pdfs"
OUT = ROOT / "data" / "sessions.json"

DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{2}$")
TIME_RE = re.compile(r"^\d{1,3}:\d{2}$")
PERCENT_RE = re.compile(r"^\d{1,3}\s*%$")
INT_RE = re.compile(r"^\d+$")

# The two week-18 files have the wrong month printed inside the PDF (June),
# but the filename dates (5 May / 8 May 2026) are correct and match the
# weekday + position in the season. Override by filename.
DATE_OVERRIDE = {
    "Tuesday 05.05.2026 Program.pdf": "05/05/26",
    "Friday 08052026 PM.pdf": "08/05/26",
}

STROKE_MAP = [
    ("IMO", "IM"),
    ("IM", "IM"),
    ("FLY", "FLY"),
    ("FS", "FS"),
    ("BK", "BK"),
    ("BR", "BR"),
    ("FRIM", "FS"),
    ("LOCO", None),  # loosen-off / choice, not a specific stroke
]
STROKE_NAMES = {"FS": "Freestyle", "BK": "Backstroke", "BR": "Breaststroke",
                "FLY": "Butterfly", "IM": "Individual Medley"}
EQUIPMENT_TOKENS = {
    "FINS": "Fins",
    "PADDLES": "Paddles",
    "PADS": "Paddles",
    "SNORKEL": "Snorkel",
    "BOARD": "Kickboard",
}


def clean(cell):
    if cell is None:
        return None
    return re.sub(r"\s+", " ", str(cell)).strip()


def clean_info(cell):
    """Like clean() but preserves line breaks in multi-line free-text sets."""
    if cell is None:
        return None
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in str(cell).split("\n")]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines) if lines else None


def squash(token):
    """Remove stray spaces pdfplumber sometimes injects, e.g. 'O n' -> 'On'."""
    if token is None:
        return None
    return re.sub(r"\s+", "", str(token))


def to_int(v):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def time_to_seconds(t):
    if not t or ":" not in t:
        return None
    mm, ss = t.split(":")
    try:
        return int(mm) * 60 + int(ss)
    except ValueError:
        return None


def iso_date(ddmmyy):
    d, m, y = ddmmyy.split("/")
    return f"20{y}-{m}-{d}"


def term_for(date_iso):
    y, m, _ = date_iso.split("-")
    m = int(m)
    if int(y) == 2025 or (int(y) == 2026 and m == 1 and False):
        return "Autumn 2025"
    # Sept-Dec => Autumn of that year; Jan-Jun => the season's spring block
    if m >= 9:
        return f"Autumn {y}"
    return f"Spring {y}"


def parse_strokes(text):
    if not text:
        return []
    up = text.upper()
    found = []
    for token, code in STROKE_MAP:
        if code is None:
            continue
        if re.search(rf"\b{re.escape(token)}\b", up) and code not in found:
            found.append(code)
    return found


def parse_equipment(text):
    if not text:
        return []
    up = text.upper()
    found = []
    for token, name in EQUIPMENT_TOKENS.items():
        if token in up and name not in found:
            found.append(name)
    return found


def is_session_meta(compact):
    return len(compact) >= 5 and compact[0] not in ("Sets", "Squad") \
        and bool(DATE_RE.match(compact[2] or "")) if len(compact) > 2 else False


def parse_block_name(compact):
    """compact starts with 'Sets','Distance', then 'Set Info'/'Second Set Info',
    then optional block-name tokens, then 'WR','Times & Rounds','Distance'."""
    try:
        wr_idx = compact.index("WR")
    except ValueError:
        wr_idx = len(compact)
    info_label = compact[2] if len(compact) > 2 else "Set Info"
    name_tokens = compact[3:wr_idx]
    if name_tokens:
        # e.g. ['ZONE','2'] -> 'Zone 2'; ['Skill Set','FS - Turns'] -> that
        if name_tokens[0].upper() == "ZONE":
            zone_no = name_tokens[1] if len(name_tokens) > 1 else "?"
            return f"Zone {zone_no}", zone_no
        return " ".join(name_tokens), None
    # No explicit name
    if "Second Set" in info_label:
        return "Second Set", None
    return "Main Set", None


def parse_set_row(raw):
    reps = to_int(raw[0]) if len(raw) > 0 else None
    distance = to_int(raw[1]) if len(raw) > 1 else None
    info = clean_info(raw[2]) if len(raw) > 2 else None

    tail = [clean(c) for c in raw[3:] if c is not None]
    wr = interval = rounds = total_time = total_dist = None
    if len(tail) >= 5:
        total_dist = to_int(tail[-1])
        total_time = squash(tail[-2])
        rounds = to_int(tail[-3])
        interval = squash(tail[-4])
        # onoff = tail[-5]
        if len(tail) >= 6:
            wr = clean(tail[-6]) or None

    is_placeholder = (reps in (0, None) and distance in (0, None)
                      and not info)
    if is_placeholder:
        return None

    if reps and distance and (reps > 0 and distance > 0):
        row_type = "set"
    else:
        # reps/distance zero but has info -> rest note or free-text block
        row_type = "free" if (info and "\n" in info) else "note"

    return {
        "type": row_type,
        "reps": reps,
        "distance": distance,
        "info": info,
        "wr": (wr if wr and PERCENT_RE.match(wr.replace(" ", "")) else (wr or None)),
        "interval": interval if interval and TIME_RE.match(interval) else None,
        "rounds": rounds,
        "total_time": total_time if total_time and TIME_RE.match(total_time) else None,
        "total_distance": total_dist,
    }


def parse_totals(cells):
    """Find printed session total time + distance, and any motivational quote."""
    vals = [clean(c) for c in cells if clean(c)]
    total_time = total_dist = quote = None
    times = [v for v in vals if TIME_RE.match(v)]
    ints = [v for v in vals if INT_RE.match(v)]
    if times:
        total_time = times[-1]
    if ints:
        total_dist = to_int(ints[-1])
    # a quote is a long free-text cell that isn't the time/number
    for v in vals:
        if len(v) > 30 and " " in v and not TIME_RE.match(v):
            quote = v
            break
    return total_time, total_dist, quote


def parse_page(table, source_file):
    """Return a session dict or None."""
    session = None
    blocks = []
    current = None

    for row in table:
        cells = [clean(c) for c in row]
        compact = [c for c in cells if c not in (None, "")]
        if not compact:
            continue

        # session meta value row
        if is_session_meta(compact):
            squad, week, date, day, phase = compact[0], compact[1], compact[2], compact[3], compact[4]
            time = compact[5] if len(compact) > 5 else None
            if date in ("Date",) or squad == "Squad":
                continue
            override = DATE_OVERRIDE.get(source_file)
            if override:
                date = override
            date_i = iso_date(date)
            day_word = day.split()[0]
            tod = None
            if re.search(r"\bAM\b", day):
                tod = "AM"
            elif re.search(r"\bPM\b", day):
                tod = "PM"
            session = {
                "squad": squad,
                "week": to_int(week),
                "date_iso": date_i,
                "day_label": day,
                "day_of_week": day_word,
                "time_of_day": tod,
                "time": time,
                "phase": phase,
                "term": term_for(date_i),
                "source_files": [source_file],
            }
            continue

        # block header
        if compact[0] == "Sets" and len(compact) > 1 and compact[1] == "Distance":
            name, zone = parse_block_name(compact)
            current = {"name": name, "zone": zone, "items": []}
            blocks.append(current)
            continue

        # totals / footer row (no reps int at start, but has a time+distance)
        if not INT_RE.match(compact[0] or ""):
            tt, td, quote = parse_totals(cells)
            if session and (tt or td):
                session.setdefault("total_time", tt)
                session.setdefault("total_distance", td)
                if quote:
                    session.setdefault("quote", quote)
            continue

        # set / note / free row
        if current is None:
            current = {"name": "Main Set", "zone": None, "items": []}
            blocks.append(current)
        item = parse_set_row(row)
        if item:
            item["strokes"] = parse_strokes(item.get("info"))
            current["items"].append(item)

    if not session:
        return None

    # drop empty blocks
    session["blocks"] = [b for b in blocks if b["items"]]
    return session


def enrich(session):
    all_info = " \n ".join(
        (it.get("info") or "") for b in session["blocks"] for it in b["items"]
    )
    strokes = []
    for b in session["blocks"]:
        for it in b["items"]:
            for s in it.get("strokes", []):
                if s not in strokes:
                    strokes.append(s)
    session["strokes"] = strokes
    session["stroke_names"] = [STROKE_NAMES[s] for s in strokes if s in STROKE_NAMES]
    session["equipment"] = parse_equipment(all_info)
    session["zones"] = sorted({b["zone"] for b in session["blocks"] if b["zone"]},
                              key=lambda z: (len(z), z))

    # totals: prefer printed; fall back to summed set distance
    summed = sum((it.get("total_distance") or 0)
                 for b in session["blocks"] for it in b["items"])
    if not session.get("total_distance"):
        session["total_distance"] = summed
    session["summed_distance"] = summed
    session["total_time_seconds"] = time_to_seconds(session.get("total_time"))
    session["duration_min"] = (round(session["total_time_seconds"] / 60)
                               if session.get("total_time_seconds") else None)

    session["categories"] = classify(session, all_info)

    # id + display
    tod = f"-{session['time_of_day'].lower()}" if session.get("time_of_day") else ""
    session["id"] = f"{session['squad'].lower()}-{session['date_iso']}-{session['day_of_week'].lower()}{tod}"
    y, m, d = session["date_iso"].split("-")
    months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    session["date_display"] = f"{int(d)} {months[int(m)]} {y}"
    return session


def classify(session, all_info):
    """Auto-tag a session's focus based on its MAIN sets (ignoring the
    boilerplate warm-up / cool-down that appear in almost every session)."""
    cats = []
    main_blocks = [b for b in session["blocks"]
                   if b["name"] not in ("Warm Up", "Cool Down")
                   and not b["name"].lower().startswith("skill")]
    main_sets = [it for b in main_blocks for it in b["items"] if it["type"] == "set"]
    main_info = " ".join((it.get("info") or "") for it in main_sets).upper()

    # IM: individual medley work in the main set
    if re.search(r"\bIMO?\b", main_info) or "MEDLEY" in main_info:
        cats.append("IM")

    # Sprint: explicit sprint/max effort, or very high work-rate short reps
    sprintish = "SPRINT" in main_info or "MAX" in main_info
    if not sprintish:
        for it in main_sets:
            wr_n = to_int((it.get("wr") or "").replace("%", "").strip())
            if wr_n and wr_n >= 95 and (it.get("distance") or 999) <= 100:
                sprintish = True
                break
    if sprintish:
        cats.append("Sprint")

    # Long-distance free: meaningful volume of 200m+ freestyle reps in main sets
    fs_vol = sum((it.get("total_distance") or 0) for it in main_sets
                 if "FS" in it.get("strokes", []) and (it.get("distance") or 0) >= 200)
    if fs_vol >= 1500:
        cats.append("Long-distance free")

    # Distance / endurance: endurance-phase or high overall volume
    phase = (session.get("phase") or "").lower()
    if phase.startswith("endurance") or (session.get("total_distance") or 0) >= 6500:
        cats.append("Distance")

    # Pure sprint: essentially just a sprint/speed set between the warm-up and
    # cool-down, with no drill/endurance/distance work mixed into the main set.
    def is_speed_or_rest(it):
        info = (it.get("info") or "").upper()
        if "RECOVERY" in info or "REST" in info:
            return True
        if any(k in info for k in ("SPRINT", "MAX", "RACE PACE", "NO:1", "NO1")):
            return True
        wr_n = to_int((it.get("wr") or "").replace("%", "").strip())
        dist = it.get("distance") or 0
        if wr_n and wr_n >= 95 and dist <= 150:
            return True
        if wr_n and wr_n >= 90 and dist <= 100:
            return True
        if 0 < dist <= 50:
            return True
        return False

    main_free = [it for b in main_blocks for it in b["items"] if it["type"] == "free"]
    if ("Sprint" in cats and "Distance" not in cats
            and "Long-distance free" not in cats):
        if (main_sets or main_free) and all(is_speed_or_rest(it) for it in main_sets):
            cats.append("Pure sprint")

    return cats


def dedup(sessions):
    by_key = {}
    order = []
    for s in sessions:
        key = (s["squad"], s["date_iso"], s["day_label"])
        n_items = sum(len(b["items"]) for b in s["blocks"])
        if key not in by_key:
            by_key[key] = s
            order.append(key)
        else:
            existing = by_key[key]
            for f in s["source_files"]:
                if f not in existing["source_files"]:
                    existing["source_files"].append(f)
            existing_items = sum(len(b["items"]) for b in existing["blocks"])
            if n_items > existing_items:
                # richer copy wins, but keep merged source list
                merged_sources = existing["source_files"]
                by_key[key] = s
                s["source_files"] = merged_sources
    return [by_key[k] for k in order]


def main():
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found in {PDF_DIR}", file=sys.stderr)
        sys.exit(1)

    raw_sessions = []
    per_file = {}
    for pdf_path in pdfs:
        name = pdf_path.name
        count = 0
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                table = page.extract_table()
                if not table:
                    continue
                sess = parse_page(table, name)
                if sess and sess["blocks"]:
                    raw_sessions.append(sess)
                    count += 1
        per_file[name] = count
        print(f"  {name}: {count} sessions")

    deduped = [enrich(s) for s in dedup(raw_sessions)]
    deduped.sort(key=lambda s: (s["date_iso"], s.get("time_of_day") or "AM"))

    payload = {
        "generated_from": [p.name for p in pdfs],
        "session_count": len(deduped),
        "sessions": deduped,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=2)

    # Also emit a JS bundle so the site works when opened directly (file://)
    # as well as on GitHub Pages, with no fetch/CORS concerns.
    site_js = ROOT / "docs" / "sessions.js"
    site_js.parent.mkdir(parents=True, exist_ok=True)
    with open(site_js, "w") as f:
        f.write("window.SESSION_DATA = ")
        json.dump(payload, f)
        f.write(";\n")

    print(f"\nRaw sessions parsed: {len(raw_sessions)}")
    print(f"After dedup:         {len(deduped)}")
    print(f"Written to:          {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
