---
description: Transcribe a fallback week and run deterministic ShiftLens reconciliation
---

Follow `AGENTS.md` exactly. The week directory is `$ARGUMENTS`.

Steps:

1. Identify documents under `$ARGUMENTS/input/actual`, `$ARGUMENTS/input/roster`, and `$ARGUMENTS/input/payslips`.
2. Ask the user to attach any images or PDFs that are not visible to the current model.
3. Transcribe actual daily sheets into `$ARGUMENTS/extracted/actual.json` using the documented schema.
4. Transcribe payslip hours into `$ARGUMENTS/extracted/payroll.json` using the documented schema.
5. Use the roster only as supporting context.
6. Return `null` for unreadable fields and mark review-required fields.
7. Do not calculate totals manually.
8. Validate JSON with `bun run scripts/validate-extraction.ts $ARGUMENTS`.
9. Run `bun run scripts/reconcile-week.ts $ARGUMENTS`.
10. Generate the Markdown report at `$ARGUMENTS/reports/reconciliation.md`.
11. List every field requiring human review.
12. Report generated file paths.
