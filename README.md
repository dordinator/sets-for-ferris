# Durham Swimming — Session Plan Library

A filterable, browsable web app of Durham University swimming squad training
sessions, extracted from the coach's PDF programme exports. Built with **Vite +
React + TypeScript** and hosted on **GitHub Pages**.

Live: **https://dordinator.github.io/sets-for-ferris/**

## Project layout

- **`src/`** — the React + TypeScript app (components, filter logic, types).
- **`src/data/sessions.json`** — the extracted session data the app imports.
- **`docs/`** — the built site that GitHub Pages serves (output of `npm run build`; do not edit by hand).
- **`source_pdfs/`** — the original coach PDF exports.
- **`scripts/`** — the Python extraction + validation scripts.
- **`data/sessions.json`** — canonical copy of the extracted data.

Each PDF page is one training session. The Python scripts parse every session
out of every PDF, **deduplicate** sessions that appear in more than one file
(keyed by squad + date + day), and tag each session with its strokes,
equipment, training zones and focus categories (Sprint / Pure sprint / Distance
/ Long-distance free / IM).

## Develop

Requires Node 18+.

```bash
npm install
npm run dev       # http://localhost:5173
```

## Build & deploy

```bash
npm run build     # outputs the static site into docs/
```

Commit and push `docs/` (and your source changes). GitHub Pages is configured
to **Deploy from a branch → `main` → `/docs`**, so it redeploys automatically.

Other scripts: `npm run preview` (serve the production build locally),
`npm run typecheck`.

## Regenerating the data (when you get new PDFs)

1. Drop the new PDF(s) into `source_pdfs/`.
2. One-time Python setup:

   ```bash
   python3 -m venv .venv
   ./.venv/bin/pip install -r requirements.txt
   ```

3. Re-extract (writes `data/sessions.json` and `src/data/sessions.json`):

   ```bash
   ./.venv/bin/python scripts/extract.py
   ./.venv/bin/python scripts/validate.py   # optional sanity check
   ```

4. `npm run build`, then commit and push.

## Notes on the data

- **Week 18** (`Tuesday 05.05.2026` / `Friday 08052026 PM`): the date printed
  inside those PDFs (June) is a typo; the filename dates (5 & 8 May 2026) are
  used because they match the weekday and season position.
- "Week 5" occurs twice in the season (autumn 29/09/25 and spring 02/02/26), so
  sessions are keyed by date, not week number.
- Focus categories are auto-assigned from each session's main sets; adjust the
  heuristics in `scripts/extract.py` (`classify`) to retune them.
