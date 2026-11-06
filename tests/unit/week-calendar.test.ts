import { describe, expect, test } from "vitest";
import { adjacentMonth, calendarDateLabel, calendarDays, isCalendarMonth, isCalendarYear, monthWeeks, yearWeekGroups } from "@/lib/week-calendar";
import type { LocalWeek } from "@/lib/week-data";

describe("monthly sheet calendar", () => {
  test("includes complete Monday–Sunday weeks across month and year boundaries", () => {
    const rows = monthWeeks("2026-01");
    expect(rows[0][0]).toBe("2025-12-29");
    expect(rows.at(-1)?.at(-1)).toBe("2026-02-01");
    expect(rows.every(row => row.length === 7 && new Date(`${row[0]}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
    expect(new Set(rows.flat()).size).toBe(rows.length * 7);
  });

  test("handles four-week February, leap days and six-week months", () => {
    expect(monthWeeks("2021-02")).toHaveLength(4);
    expect(monthWeeks("2024-02").flat()).toContain("2024-02-29");
    expect(monthWeeks("2026-03")).toHaveLength(6);
  });

  test("month navigation and labels are timezone independent", () => {
    expect(adjacentMonth("2026-01", -1)).toBe("2025-12");
    expect(adjacentMonth("2026-12", 1)).toBe("2027-01");
    expect(calendarDateLabel("2026-03-23", { weekday: "long" })).toBe("Monday");
  });

  test("rejects invalid calendar query values", () => {
    for (const value of ["2026-13", "2026-00", "2026-1", "anything", "0000-01"]) {
      expect(isCalendarMonth(value)).toBe(false);
      expect(() => monthWeeks(value)).toThrow();
    }
  });

  test("counts daily evidence, not roster context or uncertain hours as confirmation", () => {
    const week: LocalWeek = { id: "fictional", weekStarting: "2026-03-23", status: "needs_review", photoAssignments: [], employees: [], payroll: [], reviewItems: [],
      documents: [
        { id: "a", documentType: "daily_sheet", documentDate: "2026-03-23", filename: "a.png", path: "fictional/a.png", qualityWarnings: [] },
        { id: "b", documentType: "daily_sheet", documentDate: "2026-03-23", filename: "b.png", path: "fictional/b.png", qualityWarnings: [] },
        { id: "r", documentType: "roster", documentDate: "2026-03-24", filename: "roster.png", path: "fictional/roster.png", qualityWarnings: [] }
      ], shifts: [
        { id: "row", employeeId: "a", employeeName: "Fictional", date: "2026-03-23", startTime: null, finishTime: null, breakMinutes: null, status: "uncertain" },
        { id: "dismissed", employeeId: "b", employeeName: "Other Fictional", date: "2026-03-23", startTime: null, finishTime: null, breakMinutes: null, status: "dismissed" }
      ] };
    const days = calendarDays(week);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: "2026-03-23", sheetCount: 2, reviewRows: 1, recordedRows: 1 });
    expect(days[1].sheetCount).toBe(0);
    expect(days.filter(d => d.sheetCount > 0)).toHaveLength(1);
  });
});

describe("yearly week overview", () => {
  test("shows all twelve months and counts complete recorded weeks", () => {
    const weeks = [
      { weekStarting: "2026-07-13", missingDailySheetDates: [] },
      { weekStarting: "2026-07-06", missingDailySheetDates: ["2026-07-07"] },
      { weekStarting: "2026-08-03", missingDailySheetDates: [] }
    ];
    const groups = yearWeekGroups(weeks, "2026");
    expect(groups).toHaveLength(12);
    expect(groups[6].weeks.map(w => w.weekStarting)).toEqual(["2026-07-06", "2026-07-13"]);
    expect(groups[6].completeWeeks).toBe(1);
    expect(groups[7].completeWeeks).toBe(1);
    expect(groups[0].weeks).toHaveLength(0);
    expect(weeks[0].weekStarting).toBe("2026-07-13"); // Input order is untouched.
  });

  test("assigns a boundary week exactly once by its Monday date", () => {
    const weeks = [
      { weekStarting: "2025-12-29", missingDailySheetDates: [] },
      { weekStarting: "2026-06-29", missingDailySheetDates: [] },
      { weekStarting: "2026-12-28", missingDailySheetDates: [] },
      { weekStarting: "2027-01-04", missingDailySheetDates: [] }
    ];
    const groups = yearWeekGroups(weeks, "2026");
    expect(groups.flatMap(g => g.weeks)).toHaveLength(2);
    expect(groups[5].weeks[0].weekStarting).toBe("2026-06-29");
    expect(groups[6].weeks).toHaveLength(0);
    expect(groups[11].weeks[0].weekStarting).toBe("2026-12-28");
  });

  test("validates the selected year", () => {
    expect(isCalendarYear("2026")).toBe(true);
    for (const value of ["2026-01", "26", "0000", "9999", "2026.5", "no-year"]) {
      expect(isCalendarYear(value)).toBe(false);
      expect(() => yearWeekGroups([], value)).toThrow();
    }
  });
});
