import { describe, expect, test } from "vitest";
import { hoursHistory } from "@/lib/hours-history";
import type { LocalWeek } from "@/lib/week-data";
import { weekDates } from "@/lib/week-coverage";

function fixture(): LocalWeek {
  return {
    id: "fictional-week", weekStarting: "2026-12-28", status: "open", employees: [], photoAssignments: [], payroll: [], reviewItems: [],
    documents: weekDates("2026-12-28").filter(date => date !== "2027-01-02").map(date => ({ id: date, documentType: "daily_sheet", documentDate: date, filename: "fictional.svg", path: "/fictional.svg", qualityWarnings: [] })),
    shifts: [
      { id: "dec", employeeId: "a", employeeName: "Fictional A", date: "2026-12-31", startTime: "16:00", finishTime: "22:00", breakMinutes: 30, status: "confirmed" },
      { id: "jan", employeeId: "a", employeeName: "Fictional A", date: "2027-01-01", startTime: "10:00", finishTime: "18:00", breakMinutes: 0, status: "manually_entered" },
      { id: "other", employeeId: "b", employeeName: "Fictional B", date: "2027-01-01", startTime: "10:00", finishTime: "12:00", breakMinutes: 0, status: "confirmed" },
      { id: "uncertain", employeeId: "a", employeeName: "Fictional A", date: "2027-01-02", startTime: "10:00", finishTime: "18:00", breakMinutes: 0, status: "uncertain" },
      { id: "incomplete", employeeId: "a", employeeName: "Fictional A", date: "2027-01-03", startTime: "10:00", finishTime: null, breakMinutes: 0, status: "confirmed" }
    ]
  };
}

describe("hours history", () => {
  test("splits cross-month and cross-year weeks by actual shift date, preserving integer minutes", () => {
    const week = fixture();
    for (const view of ["month", "year"] as const) {
      const periods = hoursHistory([week], view, "a");
      expect(periods.map(period => period.minutes)).toEqual([480, 330]);
      expect(periods.map(period => period.shifts)).toEqual([1, 1]);
      expect(periods.map(period => period.missingDates)).toEqual([["2027-01-02"], []]);
      expect(periods.reduce((sum, period) => sum + period.minutes, 0)).toBe(hoursHistory([week], "week", "a")[0].minutes);
    }
    expect(hoursHistory([week], "month", "a").map(period => period.id)).toEqual(["2027-01", "2026-12"]);
    expect(hoursHistory([week], "year", "a").map(period => period.id)).toEqual(["2027", "2026"]);
  });

  test("team totals include other employees but exclude uncertain and incomplete shifts", () => {
    expect(hoursHistory([fixture()], "year").map(period => period.minutes)).toEqual([600, 330]);
    expect(hoursHistory([fixture()], "week")[0].shifts).toBe(3);
  });

  test("missing sheets are based on daily papers, not roster context or missing employee shifts", () => {
    const week = fixture();
    week.documents.push({ id: "roster", documentType: "roster", documentDate: "2027-01-02", filename: "fictional-roster.svg", path: "/fictional-roster.svg", qualityWarnings: [] });
    expect(hoursHistory([week], "month", "a")[0].missingDates).toEqual(["2027-01-02"]);
    week.documents.push({ ...week.documents[0], id: "missing-paper", documentDate: "2027-01-02" });
    expect(hoursHistory([week], "month", "a")[0].missingDates).toEqual([]);
  });

  test("handles empty histories and unknown employees without guessing hours", () => {
    expect(hoursHistory([], "year")).toEqual([]);
    expect(hoursHistory([fixture()], "month", "unknown")).toEqual([]);
  });
});
