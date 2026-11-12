# ShiftLens Agent Instructions

This project compares actual worked hours with paid hours.

The handwritten sheet determines actual hours after confirmation. The roster is context only. AI reads documents but does not perform final calculations. Use integer minutes. Return `null` rather than guessing. Preserve raw values. Mark uncertain fields. Ignore food information. Do not calculate tax, salary, premiums, or employment entitlements. Do not include uncertain rows in confirmed totals. Do not overwrite manually corrected data without reporting the proposed change. Do not commit real payroll or employee data.

Actual-hours JSON structure:

```json
{
  "week": "YYYY-Www",
  "documents": [
    {
      "filename": "monday.jpg",
      "date": "YYYY-MM-DD",
      "rows": [
        {
          "rawEmployeeName": "Leo",
          "employeeName": "Leonardo",
          "startTime": "15:00",
          "finishTime": "23:30",
          "breakMinutes": 30,
          "reviewRequired": false,
          "uncertainFields": [],
          "reviewReason": null
        }
      ]
    }
  ]
}
```

Payroll JSON structure:

```json
{
  "week": "YYYY-Www",
  "employees": [
    {
      "employeeName": "Leonardo",
      "ordinaryPaidMinutes": 2100,
      "sundayPaidMinutes": 420,
      "otherPaidMinutes": 0,
      "totalPaidMinutes": 2520,
      "reviewRequired": false,
      "reviewReason": null
    }
  ]
}
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
