# ShiftLens OpenCode Fallback

Use this when OCR is inaccurate or unfinished. A vision-capable OpenCode model may transcribe document images, but deterministic TypeScript scripts perform all calculations.

Required structure:

```text
fallback-data/
└── 2026-W28/
    ├── input/
    │   ├── actual/
    │   │   ├── monday.jpg
    │   │   ├── tuesday.jpg
    │   │   └── ...
    │   ├── roster/
    │   │   └── roster.jpg
    │   └── payslips/
    │       └── employee.pdf
    ├── extracted/
    │   ├── actual.json
    │   └── payroll.json
    └── reports/
        └── reconciliation.md
```

Run validation:

```bash
bun run scripts/validate-extraction.ts fallback-data/2026-W28
```

Run reconciliation:

```bash
bun run scripts/reconcile-week.ts fallback-data/2026-W28
```

The language model must return `null` and mark review-required fields rather than guessing.
