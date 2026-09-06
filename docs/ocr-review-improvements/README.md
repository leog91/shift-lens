# OCR review improvements

Implementation handoff for ShiftLens. The original specification and plan are retained as the requirements baseline. See [verification.md](verification.md) for implemented fixes and verification.

Read [specification.md](specification.md) for requirements and [implementation-plan.md](implementation-plan.md) for sequencing and acceptance checks. Follow the repository AGENTS.md throughout implementation.

## Existing changes

The working tree already contains changes to return a created shift from the API and add it to the review table without a full reload, plus stricter correction validation for clock times and integer break minutes. Review the current diff before extending these changes; do not duplicate or discard them.

The previously reported failure to clear a field was a browser automation interaction problem. Keyboard clearing saved successfully and survived reload. Preserve this behavior with regression coverage rather than assuming a persistence bug.

Existing checks passed at handoff: 34 unit tests, 8 existing demo browser tests, typecheck and production build. Lint passed with warnings. The existing demo browser tests do not cover the full editable local workflow.

## Scope boundaries

- The handwritten sheet becomes the actual-hours source of truth after human confirmation. Roster data is context only.
- AI transcribes; deterministic application code calculates using integer minutes.
- Preserve raw values, represent unknown values as null and identify uncertain fields.
- Exclude uncertain and dismissed rows from confirmed totals.
- Never silently overwrite manually corrected or confirmed values.
- Ignore food information. Do not calculate tax, salary, premiums or employment entitlements.
- Use fictional test fixtures. Never commit real employee records, photos, payroll data or extraction outputs.
