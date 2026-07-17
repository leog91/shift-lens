# ShiftLens Usage Guide

ShiftLens compares confirmed handwritten actual hours with paid hours. It is local-first: real photos and payroll data stay in ignored local files. The default workspace is fictional demo data; it cannot read or modify local files.

## Switching Businesses

Use one local profile directory for each business. Create it once:

```bash
bun run profile:init profiles/restaurant-a "Restaurant A"
```

Then start the app with that profile selected:

```bash
SHIFT_LENS_PROFILE_DIR=profiles/restaurant-a bun run
```

Each profile has independent `data/` and `photo-inbox/` folders. Stop the app before switching `SHIFT_LENS_PROFILE_DIR`; browser pages do not switch profiles while the server is running.

To isolate an existing business, stop the app and move its two storage folders into one profile directory:

```bash
mkdir -p profiles/current-restaurant
mv data photo-inbox profiles/current-restaurant/
SHIFT_LENS_PROFILE_DIR=profiles/current-restaurant bun run
```

## Golden Rules

- The handwritten daily sheet is the source of truth only after human confirmation.
- Roster images are context only. Do not use roster rows as actual worked hours.
- Food notes are ignored.
- Do not guess unreadable start, finish, or break values.
- Rows with missing or uncertain values must stay unconfirmed and must not count in confirmed totals.
- Use integer minutes for all durations.
- The app compares hours only. It does not calculate tax, salary, premiums, overtime, or employment entitlements.

## Normal Workflow

1. Start the real local profile with `SHIFT_LENS_PROFILE_DIR=profiles/restaurant-a bun run` and open `http://127.0.0.1:3000/weeks`.
2. Open `/photos` to inspect all local images before assigning them to weeks.
3. For each photo, read the visible paper title, not the WhatsApp filename.
4. Assign the photo to the week containing that paper date.
5. Open the week dashboard and check missing daily sheets.
6. Open `Actual shifts` and use `Analyze or refresh OCR rows` when local OCR is running.
7. Compare each paper with the rows the app understands and correct extracted rows inline when OCR cannot read a value.
8. Confirm only rows where employee, start, finish, and break are clear.
9. Open the review queue and resolve ambiguous payroll or break values.
10. Use `Comparison` only after the actual daily rows and payroll values are reviewed.

## Assigning Photos

Use `/photos` as an inbox for local images.

For each photo:

- Use `Week starting` for the Monday of that paper's week.
- Use `Document date` for the date printed on the paper.
- Use `Type` as `daily sheet`, `roster`, or `payslip`.
- Add a note if the date or type is uncertain.
- Click `Save assignment`.

Important: WhatsApp filenames are capture/share timestamps. They are not the sheet date. For example, a file named `WhatsApp Image 2026-07-11...` can contain a `Sunday 28 June` paper.

If the visible title and assigned date disagree, fix the assignment before extracting rows.

## Organizing Originals

Uploads are placed in `photo-inbox/manual-review/` without pre-sorting them. Files without an assignment stay there for manual handling. After assigning and checking dates, use `Move assigned photos` in `/photos` to move assigned originals into `photo-inbox/organized/<week-start>/` with a date-and-type filename.

- Files are renamed as `<paper-date>--<type>.jpeg`; a numeric suffix prevents collisions.
- Existing document paths, OCR row source references, review items, and evidence-only assignments are relinked automatically.
- Only assigned images are moved. Confirm the Photo inbox has no unassigned files first.

## Daily Sheet Review

The `Actual shifts` page shows the paper on the left and interpreted rows on the right.

Possible messages:

- `No rows have been extracted or entered for this paper yet.` means the photo is assigned but there are no shift rows for it.
- `No matching rows for the current filters.` means rows exist, but the employee/date/status filters hide them.

When entering rows:

- Preserve the raw visible values where possible.
- Use `null`/blank for unreadable fields.
- Mark uncertain rows as needing checking.
- Do not include uncertain rows in confirmed totals.
- Ignore the `Staff food` column.

## Batch Extraction

`Rescan papers and add missing OCR rows` runs the local OCR service for every daily sheet. It refreshes uncertain OCR-only rows and adds missing employees, while preserving confirmed and manually corrected rows. Start it with:

```bash
bun run dev:ocr
```

The batch action only creates rows when OCR can associate them with a known employee. Every generated row is `needs checking`, even if a time is readable. It never confirms rows or adds time to confirmed totals.

Status meanings:

- `without rows`: the paper has not been transcribed yet.
- `with OCR rows ready for verification or refresh`: OCR found review-only values; verify them beside the paper, or run the batch again after improving extraction.
- `confirmed`: a human has checked the row; only confirmed rows contribute to totals.

If the OCR service or PaddleOCR engine is unavailable, no data is changed. Start the service or correct readable existing rows inline. The first OCR run can take longer while it downloads local English models.

## Roster Use

Roster pages help answer questions like:

- Which daily sheets might be missing?
- Which employee names might appear on a sheet?
- Does a paper look like it belongs near this week?

Roster rows must not overwrite actual handwritten values. If a roster suggests someone was scheduled but the actual sheet is missing or unclear, keep that as context and request/inspect the actual paper.

## Payslip Review

Payslips provide paid minutes for comparison.

Payslip values with a decimal point are decimal hours. For example, Basic `24.08` is rounded to the nearest whole minute as `24h 05m`; it is not `24:08`. A value with a colon, such as `24:08`, is interpreted as hours and minutes.

The dashboard shows actual and paid categories side by side: Monday-Saturday, Sunday, total, difference, and status. Actual values include confirmed paper rows only.

## Duplicates

The photo inbox lists exact duplicate groups by file hash.

Only one copy should usually be assigned as the daily-sheet document for a date. Record exact duplicate or alternate copies as evidence-only assignments so they remain visible without producing duplicate OCR rows.

## Missing Weeks

If photos belong to other weeks, create or use a separate week shell instead of adding them to the current week.

A week shell can contain documents with no extracted rows. That is valid. It means the papers are grouped by date and ready for later manual extraction/review.

## Verification Before Comparing

Before trusting a weekly comparison, check:

- All expected daily sheets for the week are present or intentionally missing.
- Each assigned paper date matches the visible paper title.
- Each daily sheet has extracted or manually entered rows.
- Uncertain rows are still excluded.
- Payroll ambiguous values are resolved or still marked for review.
- Roster has not been used as actual worked time.

## Developer Checks

Run these after changing code or local metadata behavior:

```bash
bun run typecheck
bun run build
bun run lint
bun run test:e2e
```

Lint currently warns about local preview `<img>` elements. These previews are intentional for local files.
