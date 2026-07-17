import type { LocalWeek } from "@/lib/week-data";

const employees = [
  { id: "employee-alex-example", displayName: "Alex Example", aliases: ["A. Example"] },
  { id: "employee-casey-sample", displayName: "Casey Sample", aliases: [] },
  { id: "employee-jordan-fiction", displayName: "Jordan Fiction", aliases: ["J. Fiction"] }
];

export const demoWeeks: LocalWeek[] = [
  {
    id: "demo-week-28",
    weekStarting: "2026-07-06",
    status: "needs_review",
    documents: [
      { id: "demo-daily-1", documentType: "daily_sheet", documentDate: "2026-07-06", filename: "demo-monday-sheet.jpg", path: "demo/monday-sheet.jpg", qualityWarnings: ["Demo document: original image is not included."] },
      { id: "demo-payslip-1", documentType: "payslip", documentDate: "2026-07-12", filename: "demo-weekly-payslip.png", path: "demo/weekly-payslip.png", qualityWarnings: [] }
    ],
    photoAssignments: [],
    employees,
    shifts: [
      { id: "demo-shift-1", employeeId: "employee-alex-example", employeeName: "Alex Example", date: "2026-07-06", startTime: "09:00", finishTime: "17:00", breakMinutes: 30, status: "confirmed", sourceDocument: "demo-monday-sheet.jpg" },
      { id: "demo-shift-2", employeeId: "employee-casey-sample", employeeName: "Casey Sample", date: "2026-07-06", startTime: "12:00", finishTime: "20:00", breakMinutes: 30, status: "confirmed", sourceDocument: "demo-monday-sheet.jpg" },
      { id: "demo-shift-3", employeeId: "employee-jordan-fiction", employeeName: "Jordan Fiction", date: "2026-07-06", startTime: null, finishTime: "22:00", breakMinutes: 30, status: "uncertain", sourceDocument: "demo-monday-sheet.jpg" }
    ],
    payroll: [
      { employeeId: "employee-alex-example", employeeName: "Alex Example", ordinaryPaidMinutes: 420, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 420 },
      { employeeId: "employee-casey-sample", employeeName: "Casey Sample", ordinaryPaidMinutes: 450, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 450 },
      { employeeId: "employee-jordan-fiction", employeeName: "Jordan Fiction", ordinaryPaidMinutes: 0, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: null }
    ],
    reviewItems: [
      { id: "demo-review-1", employeeName: "Jordan Fiction", filename: "demo-monday-sheet.jpg", documentPath: "demo/monday-sheet.jpg", reviewType: "start_time", raw: "?", proposed: null, reason: "Start time is unreadable in this fictional example." }
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
      { id: "demo-shift-4", employeeId: "employee-alex-example", employeeName: "Alex Example", date: "2026-06-30", startTime: "10:00", finishTime: "18:00", breakMinutes: 30, status: "confirmed", sourceDocument: null },
      { id: "demo-shift-5", employeeId: "employee-casey-sample", employeeName: "Casey Sample", date: "2026-07-01", startTime: "11:00", finishTime: "17:00", breakMinutes: 30, status: "confirmed", sourceDocument: null }
    ],
    payroll: [
      { employeeId: "employee-alex-example", employeeName: "Alex Example", ordinaryPaidMinutes: 450, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 450 },
      { employeeId: "employee-casey-sample", employeeName: "Casey Sample", ordinaryPaidMinutes: 330, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 330 }
    ],
    reviewItems: []
  }
];
