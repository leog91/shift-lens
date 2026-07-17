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
