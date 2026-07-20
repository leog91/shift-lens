import type { LocalWeek } from "@/lib/week-data";

const employees = [
  { id: "employee-alex-example", displayName: "Alex Example", aliases: ["A. Example"] },
  { id: "employee-casey-sample", displayName: "Casey Sample", aliases: [] },
  { id: "employee-jordan-fiction", displayName: "Jordan Fiction", aliases: ["J. Fiction"] },
  { id: "employee-morgan-demo", displayName: "Morgan Demo", aliases: ["M. Demo"] },
  { id: "employee-riley-demo", displayName: "Riley Demo", aliases: [] }
];

export const demoWeeks: LocalWeek[] = [
  {
    id: "demo-week-28",
    weekStarting: "2026-07-06",
    status: "needs_review",
    documents: [
      { id: "demo-daily-1", documentType: "daily_sheet", documentDate: "2026-07-06", filename: "demo-monday-sheet.svg", path: "/demo/daily-sheet-monday.svg", qualityWarnings: ["Fictional demo document. Editing and OCR are disabled."] },
      { id: "demo-daily-2", documentType: "daily_sheet", documentDate: "2026-07-08", filename: "demo-wednesday-sheet.svg", path: "/demo/daily-sheet-wednesday.svg", qualityWarnings: ["Fictional demo document. Editing and OCR are disabled."] },
      { id: "demo-daily-3", documentType: "daily_sheet", documentDate: "2026-07-10", filename: "demo-friday-sheet.svg", path: "/demo/daily-sheet-friday.svg", qualityWarnings: ["Fictional demo document. Editing and OCR are disabled."] },
      { id: "demo-roster-1", documentType: "roster", documentDate: "2026-07-06", filename: "demo-weekly-roster.svg", path: "/demo/weekly-roster.svg", qualityWarnings: [] },
      { id: "demo-payslip-1", documentType: "payslip", documentDate: "2026-07-12", filename: "demo-weekly-payslip.svg", path: "/demo/weekly-payslip.svg", qualityWarnings: [] }
    ],
    photoAssignments: [],
    employees,
    shifts: [
      { id: "demo-shift-1", employeeId: "employee-alex-example", employeeName: "Alex Example", date: "2026-07-06", startTime: "09:00", finishTime: "17:00", breakMinutes: 30, status: "confirmed", sourceDocument: "demo-monday-sheet.svg" },
      { id: "demo-shift-2", employeeId: "employee-casey-sample", employeeName: "Casey Sample", date: "2026-07-06", startTime: "12:00", finishTime: "20:00", breakMinutes: 30, status: "confirmed", sourceDocument: "demo-monday-sheet.svg" },
      { id: "demo-shift-3", employeeId: "employee-jordan-fiction", employeeName: "Jordan Fiction", date: "2026-07-06", startTime: null, finishTime: "22:00", breakMinutes: 30, status: "uncertain", sourceDocument: "demo-monday-sheet.svg" },
      { id: "demo-shift-4", employeeId: "employee-alex-example", employeeName: "Alex Example", date: "2026-07-08", startTime: "10:00", finishTime: "18:00", breakMinutes: 30, status: "confirmed", sourceDocument: "demo-wednesday-sheet.svg" },
      { id: "demo-shift-5", employeeId: "employee-morgan-demo", employeeName: "Morgan Demo", date: "2026-07-08", startTime: "14:00", finishTime: "22:00", breakMinutes: 30, status: "confirmed", sourceDocument: "demo-wednesday-sheet.svg" },
      { id: "demo-shift-6", employeeId: "employee-casey-sample", employeeName: "Casey Sample", date: "2026-07-10", startTime: "11:00", finishTime: "19:00", breakMinutes: 30, status: "confirmed", sourceDocument: "demo-friday-sheet.svg" },
      { id: "demo-shift-7", employeeId: "employee-riley-demo", employeeName: "Riley Demo", date: "2026-07-10", startTime: "16:00", finishTime: "23:30", breakMinutes: 30, status: "confirmed", sourceDocument: "demo-friday-sheet.svg" }
    ],
    payroll: [
      { employeeId: "employee-alex-example", employeeName: "Alex Example", ordinaryPaidMinutes: 420, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 420 },
      { employeeId: "employee-casey-sample", employeeName: "Casey Sample", ordinaryPaidMinutes: 450, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 450 },
      { employeeId: "employee-jordan-fiction", employeeName: "Jordan Fiction", ordinaryPaidMinutes: 0, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: null },
      { employeeId: "employee-morgan-demo", employeeName: "Morgan Demo", ordinaryPaidMinutes: 450, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 450 },
      { employeeId: "employee-riley-demo", employeeName: "Riley Demo", ordinaryPaidMinutes: 420, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 420 }
    ],
    reviewItems: [
      { id: "demo-review-1", employeeName: "Jordan Fiction", filename: "demo-monday-sheet.svg", documentPath: "/demo/daily-sheet-monday.svg", reviewType: "start_time", raw: "?", proposed: null, reason: "Start time is unreadable in this fictional example." }
    ]
  },
  {
    id: "demo-week-27",
    weekStarting: "2026-06-29",
    status: "needs_review",
    documents: [],
    photoAssignments: [],
    employees,
    shifts: [
      { id: "demo-shift-8", employeeId: "employee-alex-example", employeeName: "Alex Example", date: "2026-06-30", startTime: "10:00", finishTime: "18:00", breakMinutes: 30, status: "confirmed", sourceDocument: null },
      { id: "demo-shift-9", employeeId: "employee-casey-sample", employeeName: "Casey Sample", date: "2026-07-01", startTime: "11:00", finishTime: "17:00", breakMinutes: 30, status: "confirmed", sourceDocument: null },
      { id: "demo-shift-10", employeeId: "employee-morgan-demo", employeeName: "Morgan Demo", date: "2026-07-03", startTime: "15:00", finishTime: "23:00", breakMinutes: 30, status: "confirmed", sourceDocument: null }
    ],
    payroll: [
      { employeeId: "employee-alex-example", employeeName: "Alex Example", ordinaryPaidMinutes: 450, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 450 },
      { employeeId: "employee-casey-sample", employeeName: "Casey Sample", ordinaryPaidMinutes: 330, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 330 }
    ],
    reviewItems: []
  },
  {
    id: "demo-week-26",
    weekStarting: "2026-06-22",
    status: "reconciled",
    documents: [],
    photoAssignments: [],
    employees,
    shifts: [
      { id: "demo-shift-11", employeeId: "employee-alex-example", employeeName: "Alex Example", date: "2026-06-23", startTime: "09:00", finishTime: "17:00", breakMinutes: 30, status: "confirmed", sourceDocument: null },
      { id: "demo-shift-12", employeeId: "employee-riley-demo", employeeName: "Riley Demo", date: "2026-06-25", startTime: "12:00", finishTime: "20:00", breakMinutes: 30, status: "confirmed", sourceDocument: null }
    ],
    payroll: [
      { employeeId: "employee-alex-example", employeeName: "Alex Example", ordinaryPaidMinutes: 450, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 450 },
      { employeeId: "employee-riley-demo", employeeName: "Riley Demo", ordinaryPaidMinutes: 450, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 450 }
    ],
    reviewItems: []
  },
  {
    id: "demo-week-29",
    weekStarting: "2026-07-13",
    status: "open",
    documents: [],
    photoAssignments: [],
    employees,
    shifts: [
      { id: "demo-shift-13", employeeId: "employee-alex-example", employeeName: "Alex Example", date: "2026-07-13", startTime: "09:00", finishTime: "17:00", breakMinutes: 30, status: "confirmed", sourceDocument: null },
      { id: "demo-shift-14", employeeId: "employee-casey-sample", employeeName: "Casey Sample", date: "2026-07-14", startTime: "13:00", finishTime: "21:00", breakMinutes: 30, status: "confirmed", sourceDocument: null },
      { id: "demo-shift-15", employeeId: "employee-morgan-demo", employeeName: "Morgan Demo", date: "2026-07-15", startTime: "11:00", finishTime: "19:00", breakMinutes: 30, status: "confirmed", sourceDocument: null }
    ],
    payroll: [],
    reviewItems: []
  }
];
