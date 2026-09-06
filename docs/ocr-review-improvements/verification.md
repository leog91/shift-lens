# Review fixes and verification

Implemented and verified on 6 September 2026.

## Changes

- Rescans retain dismissed, restored, confirmed and manually corrected rows. Matching uses the source document and employee, rather than an unstable OCR row number. Edits made while OCR runs survive the final merge. Failed document extraction does not remove existing rows.
- Dismiss and restore actions retain an inspectable history. Corrections show their reason, previous values and replacement values alongside original OCR provenance. SQLite migrates existing databases and stores this history in backups.
- Clearing a value saves null and flags the missing field. Uncertain and dismissed rows stay outside confirmed totals.
- Failed confirmation and edit requests release their saving state so the user can retry. Controls prevent duplicate submissions. A dismissed proposal can be replaced with a manually added row.
- Rescans and row additions update the table without reloading it. Review filters and selected rows persist for the browser session; scroll position is restored on returning to the page.
- Source highlights scale against the actual image dimensions, including cached images. Missing or incompatible coordinate metadata shows the full source photo.
- The SQLite test now runs under Node rather than being skipped under Bun. Demo browser tests use port 3100; editable tests use port 3101 and a disposable fictional profile with a deterministic mock OCR service.

## Verification

- `bun run test`: 47 unit tests and 15 OCR service tests passed.
- `bun run test:e2e`: all 8 existing demo tests passed.
- `bun run build`, then `bun run test:e2e --config playwright.local.config.ts`: all 5 editable workflow tests passed, covering dismissal/rescan/restore, correction and backup recovery, failed-confirmation retry, missing-row replacement, image geometry and concurrent editing during extraction.
- Typecheck passed. Lint reported no errors and six image-element warnings. Production build passed with the existing broad file-tracing warning in the backup module.

The browser OCR companion deliberately returns fictional, deterministic data. These tests verify review and persistence behavior, not real handwriting recognition accuracy. New OCR rows still require human review. Real employee data was not modified by this verification.
