# Durham Swimming — Session Plan Library

A filterable, browsable web app of Durham University swimming squad training
sessions, extracted from the coach's PDF programme exports. Built to be hosted
on **GitHub Pages**.

- **`docs/`** — the static website (this is what GitHub Pages serves).
- **`source_pdfs/`** — the original coach PDF exports.
- **`scripts/`** — the extraction + validation scripts.
- **`data/sessions.json`** — the extracted, deduplicated session data.

Each PDF page is one training session. The scripts parse every session out of
every PDF, **deduplicate** sessions that appear in more than one file (keyed by
squad + date + day), and tag each session with its strokes, equipment, training
zones and focus categories (Sprint / Distance / Long-distance free / IM).

## Browsing the site

Open `docs/index.html`. On GitHub Pages it lives at your Pages URL. You can
filter by search text, session focus, phase, term, stroke, equipment, time of
day, total distance and duration; sort; and expand any session to see the full
set-by-set breakdown.

## Regenerating the data (when you get new PDFs)

1. Drop the new PDF(s) into `source_pdfs/`.
2. Set up the environment once:

   ```bash
   python3 -m venv .venv
   ./.venv/bin/pip install -r requirements.txt
   ```

3. Re-run the extractor (writes `data/sessions.json` **and** `docs/sessions.js`):

   ```bash
   ./.venv/bin/python scripts/extract.py
   ```

4. (Optional) sanity-check the output:

   ```bash
   ./.venv/bin/python scripts/validate.py
   ```

5. Commit and push. GitHub Pages redeploys automatically.

## Previewing locally

```bash
cd docs && python3 -m http.server 8000
# then open http://localhost:8000
```

## Notes on the data

- **Week 18** (`Tuesday 05.05.2026` / `Friday 08052026 PM`): the date printed
  inside those PDFs (June) is a typo; the filename dates (5 & 8 May 2026) are
  used because they match the weekday and season position.
- "Week 5" occurs twice in the season (autumn 29/09/25 and spring 02/02/26), so
  sessions are keyed by date, not week number.
- Focus categories are auto-assigned from each session's main sets; adjust the
  heuristics in `scripts/extract.py` (`classify`) if you want to retune them.
