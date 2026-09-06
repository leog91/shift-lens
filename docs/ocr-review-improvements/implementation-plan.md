# Implementation plan and validation

## Phase 1: Inspect and design

Review AGENTS.md, the current diff, the local SQLite schema, extraction adapters, review routes, profile backups and UI state handling.

Relevant starting points:
- src/components/ActualWeekClient.tsx
- src/components/BatchExtractionButton.tsx
- src/app/api/shifts/create/route.ts
- src/app/api/shifts/update/route.ts
- src/app/api/extraction/batch/route.ts
- src/lib/shift-update-actions.ts
- src/lib/local-sqlite-store.ts
- src/lib/week-data.ts
- tests/unit/reconciliation.test.ts
- tests/e2e/workflows.spec.ts

Define the additive data model and migration for extraction provenance, field uncertainty, stable proposal identity, dismissal and correction history before changing UI behavior. Decide how legacy records with missing provenance will be represented explicitly.

## Phase 2: Dismissal and correction history

Implement persistence and transitions first, then expose dismissal, restoration and audit history in the review UI. Preserve original values and ensure all non-confirmed states remain excluded from totals. Ensure rescans and photo organization respect these records.

## Phase 3: Review continuity

Extend the existing no-reload missing-row change. Replace delayed rescan reloads with deliberate state refresh, retain filters and selection, protect drafts, and add pending/error states. Avoid accepting stale responses over newer edits.

## Phase 4: OCR matching and highlighting

Build fictional extraction fixtures before changing matching. Associate names and values within table-row geometry. Carry coordinates and uncertainty through the validated extraction schema. Use those coordinates for highlighting, with an explicit full-image fallback.

## Validation matrix

| Scenario | Expected result |
| --- | --- |
| Import → extract | Review-only proposals, no confirmed minutes |
| Correct → confirm | Deterministic integer-minute totals include the reviewed row |
| Clear a field → reload | Null persists; row remains excluded |
| Correct → rescan | Reviewed values survive; conflicting extraction is only a proposal |
| Dismiss → reload → rescan | Proposal stays dismissed and excluded |
| Restore dismissal | Proposal returns to review, not confirmation |
| Organize source photo | Provenance, dismissal and highlighting remain attached |
| Add row with filters active | Filters, selection and other drafts remain intact |
| Network error or repeated click | No duplicate write; draft remains available |
| Backup → restore | Values, history and dismissals survive |
| Blank/adjacent/tilted source rows | No confident cross-row time assignment |
| Missing source coordinates | Full-photo fallback with no false highlight |

Use temporary isolated local profiles with fictional records for editable browser tests. Do not use operational employee data as committed fixtures. Run browser tests on a separate port so the user's local app can remain available. The Next.js server must use Node for better-sqlite3 compatibility.

Required checks:

```sh
bun run test:unit
bun run typecheck
bun run lint
bun run test:e2e
bun run build
```

Also run the OCR Python test suite when changing the OCR service. Add integration coverage for SQLite migration and persistence, and editable browser coverage for the new workflow; the existing read-only demo tests alone are insufficient.

## Completion criteria

All acceptance criteria in specification.md are satisfied, migrations preserve existing profiles, relevant tests pass, and the implementation handoff states any remaining OCR limitations. Do not present improved OCR accuracy as proven without fixture-based evidence. Keep real data and generated private artifacts out of Git.
