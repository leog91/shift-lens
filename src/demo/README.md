# Demo Data

`seed.ts` contains only fictional records used by the public, read-only demo.
At runtime, `database.ts` loads this deterministic seed into an in-memory SQLite database and enables SQLite query-only mode.

The matching illustrative documents are in `public/demo/`. They are fictional SVGs, not workplace records or processed uploads.

Do not add real employee, roster, payroll, or document data here.
