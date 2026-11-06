# ShiftLens

ShiftLens is a local-first restaurant tool for comparing actual worked hours with paid hours. It starts in a fictional, non-editable demo workspace by default.

It answers one question:

```text
actual worked minutes - paid minutes = difference
```

A positive difference means potentially missing paid hours. A negative difference means the payslip contains more hours than the actual sheets.

ShiftLens is not a payroll, tax, employment-law, salary, premium, overtime, or entitlement calculator.

## Concepts

- Actual means the confirmed handwritten daily work sheet. After human review, it is the source of truth for worked hours.
- Roster means planned shifts. It is optional context only and never overwrites actual handwritten values.
- Payroll means hours displayed on payslips: ordinary (Monday-Saturday), Sunday, other, and total paid minutes. Decimal payslip hours are rounded to the nearest whole minute.
- Review means a field was unreadable, ambiguous, low-confidence, or manually corrected.

## Architecture

- Next.js App Router is the main product.
- SQLite stores local data. Each profile keeps its own `data/shiftlens.sqlite`, read and written directly through `src/lib/local-sqlite-store.ts`. The public demo uses a separate in-memory SQLite database seeded only with committed fictional records.
- Deterministic TypeScript functions under `src/domain/reconciliation/` do all calculations.
- FastAPI under `ocr-service/` is a local OCR companion.
- OCR providers are isolated behind `DocumentExtractor` adapters: `PaddleOcrExtractor`, `ManualExtractor`, and an optional structured `OpenAiVisionExtractor`.
- The app works without OpenAI. OpenAI is only available when `OPENAI_API_KEY` and `OPENAI_VISION_MODEL` are configured.

## Requirements

- Bun
- Node.js
- Python 3
- SQLite
- Optional: PaddleOCR for real local OCR model inference

## Setup

Install web dependencies:

```bash
bun install
```

Create a local profile to hold your data. The demo workspace needs no setup:

```bash
bun run profile:init profiles/restaurant-a "Restaurant A"
```

Set up OCR service:

```bash
cd ocr-service
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

PaddleOCR and PaddlePaddle are included in `ocr-service/requirements.txt`. The first OCR run downloads local English models. Batch extraction creates only needs-checking rows and never includes them in confirmed totals.

## Run

Run the fictional demo workspace (safe for UI development and portfolio screenshots):

```bash
bun run demo
```

Run the real local workflow with OCR. This mode is explicit so a demo or deployed instance never reads a local profile by accident:

```bash
SHIFT_LENS_PROFILE_DIR=profiles/restaurant-a bun run
```

Run the OCR service:

```bash
bun run dev:ocr
```

`dev:ocr` uses `ocr-service/.venv`. Create and install it once if it does not exist:

```bash
cd ocr-service
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Run both with a simple concurrent script:

```bash
bun run dev
```

Open `http://127.0.0.1:3000/weeks`.

## Usage Guide

See `docs/usage.md` for the practical operator workflow, including photo assignment, daily sheet review, roster context, duplicate handling, and when comparison totals are safe to use.

## Business Profiles

ShiftLens can keep each business in a separate local profile. A profile contains its SQLite database and `photo-inbox/` originals, so employee names and documents are never mixed between businesses.

Create profiles outside the repository, or under the ignored `profiles/` directory:

```bash
bun run profile:init profiles/restaurant-a "Restaurant A"
bun run profile:init profiles/restaurant-b "Restaurant B"
```

Start ShiftLens for one profile at a time. `SHIFT_LENS_DATA_MODE=local` is required to load, scan, or change that profile:

```bash
SHIFT_LENS_PROFILE_DIR=profiles/restaurant-a bun run
```

Use the same environment variable for any command that touches profile storage. The default, when no variable is supplied, remains the repository's local `data/` and `photo-inbox/` folders for backwards compatibility.

To move the current business into its own profile, stop the app first, then move both storage folders together:

```bash
mkdir -p profiles/current-restaurant
mv data photo-inbox profiles/current-restaurant/
SHIFT_LENS_PROFILE_DIR=profiles/current-restaurant bun run
```

Do not copy or share a profile directory through Git. It contains personal employee and payroll data.

## Data Modes

- `demo` is selected with `bun run demo`. It loads only tracked fictional records from `src/demo/` into a read-only in-memory SQLite database. Bundled fictional documents are viewable, but uploads, edits, local photos, and OCR are disabled.
- `local` is selected with `bun run`. It loads the ignored profile SQLite database and photo inbox for private processing, with local OCR.
- A future hosted database mode should be a separate, authenticated deployment with a separate database from the demo.

The deployed demo is safe to share because it has no real profiles, no persisted user edits, and no image-processing service. Real employee and document processing remains in local mode. A future hosted editing product should use authentication and company-scoped storage; it must remain separate from both the demo database and local profile files.

Local profiles created with `profile:init` have no `profile.json`. Their `data/shiftlens.sqlite` database contains the company ID, business name, schema version, settings, and all local week data. Existing JSON profiles are imported automatically into SQLite on their first local-mode read; the JSON files are retained as an untouched backup.

Use `/backups` in local mode to create or restore profile snapshots. A snapshot includes the complete `data/` folder, all `photo-inbox/` originals, and legacy `profile.json` metadata when present, with a checksum manifest. This covers all ShiftLens business data: employees, shifts, payroll entries, documents, reviews, settings, and original photos. Restores verify every file and create a pre-restore safety copy first. Snapshots do not include the application source, dependencies, or environment secrets such as `.env` files. Backups default to a sibling `shiftlens-backups/<profile-name>/` directory; set `SHIFT_LENS_BACKUP_DIR` to use another local location. Keep backup storage outside Git and include it in your normal encrypted/off-device backup routine.

Each backup is a timestamped directory. Copy the entire directory when moving it to encrypted or off-device storage; do not copy individual files from inside it:

```text
shiftlens-backups/
  restaurant-a/
    2026-07-20T18-51-58-123Z-<id>/
      data/
      photo-inbox/
      profile.json     # present only for legacy profiles
      manifest.json
```

Never infer the mode from whether a profile directory exists. Keeping local mode explicit prevents an accidental deployment from exposing a local profile.

## Deploying The Demo

Deploy only the fictional demo to Vercel. It runs a read-only, in-memory SQLite database that is seeded on each server instance and does not process or persist user files.

- Framework preset: `Next.js`
- Install command: `bun install --frozen-lockfile`
- Build command: `bun run build`
- Environment variable: `SHIFT_LENS_DATA_MODE=demo`
- Do not configure `SHIFT_LENS_PROFILE_DIR`, `DATABASE_URL`, OCR, or OpenAI variables.

Vercel runs the production Next.js server itself; do not configure `bun run dev` as a start command. `better-sqlite3` is listed in `serverExternalPackages` so the native module remains available to server functions.

## Phone Photos

Use `/weeks/<weekId>/documents` to preview and validate a local photo before assigning it from `/photos`. The input accepts images and PDFs:

```html
<input type="file" accept="image/*,.pdf" capture="environment" />
```

Browser support for `capture` varies. Use the Photo inbox to select images from your computer; the app copies them into `photo-inbox/manual-review/` as unassigned files. Assign their date and type, then move the assigned files into categorized folders when ready.

### Large PDF imports (local only)

PDF uploads support up to 100 MB / 500 pages. Rendering is page-by-page with bounded image dimensions. Originals, page images and a manifest are retained together in a content-addressed inbox folder; reimporting resumes rather than duplicating pages. PDF pages remain in that folder when organizing photos so their original/page references stay valid.

For a large import, use the command-line workflow to avoid holding the upload in the web server. Run these commands from the repository root, with the same `SHIFT_LENS_PROFILE_DIR` on every command if using a separate profile:

```bash
ocr-service/.venv/bin/python ocr-service/app/pdf_import.py /path/to/sheets.pdf photo-inbox/manual-review
bun build scripts/import-pdf-hours.ts --target=node --packages=external --outfile=extracted/import-pdf-hours.mjs
SHIFT_LENS_DATA_MODE=local node extracted/import-pdf-hours.mjs photo-inbox/manual-review/pdf-<sha256> --prepare
PYTHONPATH=ocr-service OMP_NUM_THREADS=1 ocr-service/.venv/bin/python -m app.pdf_batch photo-inbox/manual-review/pdf-<sha256> --year <confirmed-year> --employees photo-inbox/manual-review/pdf-<sha256>/ocr/employees.json --apply-script extracted/import-pdf-hours.mjs
```

Replace `pdf-<sha256>` with the directory returned by the first command. The prepare step creates a full profile backup and exports employee labels for local OCR. Node, rather than Bun, runs the bundled importer because it uses the native `better-sqlite3` module. For a separate profile, supply the absolute inbox directory inside that profile.

Each page has an atomic OCR checkpoint. Rerun the last command after interruption; completed pages are reused. Workers restart every eight pages to release native model allocations. The default is one worker (roughly 1 GB RAM); optionally use `--jobs 2` through `--jobs 4` only when sufficient memory is available. Completed batches are published to SQLite automatically.

The year must be confirmed by the operator. Dates are assigned only when the printed weekday, day and month agree; ambiguous dates remain in the inbox, listed in `ocr/import-report-*.json`. All imported hours are uncertain until human review. Unknown printed employee names are retained as review-required identities. Existing employee/date rows are preserved rather than duplicated. Reimporting does not replace manual edits or confirmations.

If parsing rules change, `--reparse` on the Python batch command regenerates proposals from saved text without rerunning OCR. Then run the Node importer with `--refresh-proposals` to replace only this PDF's untouched uncertain proposals; corrected, dismissed and confirmed rows remain protected.

The OCR service keeps the original image and can write a processed extraction preview. Quality warnings are advisory unless the image cannot be decoded.

## Review

Unreadable or ambiguous fields use `null` and create review items. Confirmed totals exclude uncertain rows. Corrections should be audited through correction records rather than silently overwriting values.

## Reconciliation

The domain layer stores durations as integer minutes and supports normal shifts, breaks, overnight shifts, split shifts, duplicate detection, invalid breaks, and Sunday minute categorisation.

Breaks across midnight are currently treated as a limitation because the exact break time is usually unknown.

## Manual Fallback

If OCR is unavailable or inaccurate, use inline row correction beside the document. Keep unreadable values blank and unconfirmed; confirmed totals exclude them.

## Optional OpenAI Vision

Set both variables to enable the optional adapter structure:

```env
OPENAI_API_KEY=
OPENAI_VISION_MODEL=
```

Do not hardcode a model. Responses must be validated with Zod, preserve raw values, return `null` rather than guessing, and never provide final calculations.

## Tests

```bash
bun run typecheck
bun run lint
bun run test:unit
cd ocr-service && python3 -m pytest
bun run test:e2e
bun run build
```

## Export

The fallback script generates a Markdown report with:

```text
Employee | Actual | Paid | Difference | Status
```

The product structure is ready for CSV, JSON, and Markdown exports without exporting original photos unless explicitly selected.

## OpenCode Fallback

Use this structure:

```text
fallback-data/
└── 2026-W28/
    ├── input/
    │   ├── actual/
    │   ├── roster/
    │   └── payslips/
    ├── extracted/
    │   ├── actual.json
    │   └── payroll.json
    └── reports/
        └── reconciliation.md
```

Then run:

```bash
bun run scripts/validate-extraction.ts fallback-data/2026-W28
bun run scripts/reconcile-week.ts fallback-data/2026-W28
```

Or run the OpenCode command `.opencode/commands/reconcile-week.md` with the week directory. The model transcribes only; TypeScript performs the maths.

## Privacy

Ignored paths include `data/`, `uploads/`, `input/`, `extracted/`, `reports/`, `fallback-data/`, SQLite files, and env files.

Do not commit real employee names, payslips, daily sheets, uploaded images, extraction outputs, databases, or API keys.

### Publishing The Code Safely

The application code can be public while operational data stays local.

- `data/` is ignored: it contains `shiftlens.sqlite`, employee names, confirmed hours, payroll values, and UI preferences.
- `profiles/` is ignored: it can contain one complete local profile per business.
- `photo-inbox/` is ignored: uploads wait in `manual-review/` until assigned. The app moves assigned originals into `organized/<week>/` folders with descriptive filenames.
- `.playwright-mcp/`, OCR previews, databases, and environment files are ignored because they can contain local paths or document-derived data.

Before the first commit, verify that no private path is staged:

```bash
git init
git add .
git status --short
git check-ignore -v data/shiftlens.sqlite photo-inbox/organized .playwright-mcp
```

`git status --short` must not list `data/`, `photo-inbox/`, `.playwright-mcp/`, `.env*`, or SQLite files. If it does, unstage them with `git restore --staged <path>` and fix `.gitignore` before committing.

After that check, create the first commit and connect the GitHub repository:

```bash
git commit -m "Initial ShiftLens application"
git branch -M main
git remote add origin git@github.com:YOUR-ACCOUNT/shift-lens.git
git push -u origin main
```

## Current Limitations

- PDF embedded-text extraction is not fully implemented yet.
- Template-assisted boundary adjustment is represented architecturally but needs UI persistence.
- Break allocation across midnight is documented as a limitation.
