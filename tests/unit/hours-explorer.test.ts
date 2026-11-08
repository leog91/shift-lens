import { describe, expect, test } from "vitest";
import type { ShiftInput } from "@/domain/reconciliation";
import { employeeHoursRanking, employeeHoursSummary } from "@/lib/confirmed-hours";
import { availableHoursPeriods, hoursPaperCoverage, hoursPeriodKey, shiftsForPeriod } from "@/lib/hours-explorer";

const shift = (overrides: Partial<ShiftInput> = {}): ShiftInput => ({ id: "s", employeeId: "a", employeeName: "Fictional A", date: "2026-12-31", startTime: "09:00", finishTime: "17:00", breakMinutes: 30, status: "confirmed", ...overrides });

describe("employee hours summaries and rankings", () => {
  test("combines split shifts by employee ID with daily and weekly totals", () => {
    const shifts = [shift(), shift({ id: "split", startTime: "18:00", finishTime: "20:00", breakMinutes: 0 }), shift({ id: "next", date: "2027-01-01", status: "manually_entered" })];
    expect(employeeHoursSummary(shifts, "2026-12-31")).toEqual([{ employeeId: "a", employeeName: "Fictional A", minutes: 570, weekMinutes: 1020, reviewRows: 0, daysWorked: 1 }]);
    expect(employeeHoursSummary(shifts)[0].minutes).toBe(1020);
    expect(employeeHoursSummary(shifts)[0].daysWorked).toBe(2);
  });

  test("does not merge different employees with the same name", () => {
    expect(employeeHoursSummary([shift(), shift({ employeeId: "b" })])).toHaveLength(2);
  });

  test("excludes unconfirmed, invalid, incomplete and dismissed rows without guessing zero", () => {
    const shifts = [shift({ status: "uncertain" }), shift({ status: "extracted" }), shift({ finishTime: null }), shift({ breakMinutes: 999 }), shift({ employeeId: "dismissed", status: "dismissed" })];
    expect(employeeHoursRanking(shifts)).toEqual([{ employeeId: "a", employeeName: "Fictional A", minutes: null, weekMinutes: null, reviewRows: 4, daysWorked: 0, rank: null }]);
    expect(employeeHoursSummary(shifts, "2027-01-01")).toEqual([]);
  });

  test("ranks most hours first, shares ties, and leaves review-only people unranked", () => {
    const ranking = employeeHoursRanking([
      shift({ employeeId: "low", finishTime: "10:00", breakMinutes: 0 }),
      shift({ employeeId: "tie", employeeName: "Fictional B" }), shift(),
      shift({ employeeId: "review", status: "uncertain" })
    ]);
    expect(ranking.map(person => [person.employeeId, person.rank])).toEqual([["a", 1], ["tie", 1], ["low", 3], ["review", null]]);
  });

  test("deducts breaks and assigns overnight work to its recorded date", () => {
    expect(employeeHoursSummary([shift({ startTime: "22:00", finishTime: "02:00", breakMinutes: 15 })], "2026-12-31")[0]).toMatchObject({ minutes: 225, daysWorked: 1 });
  });

  test("days worked excludes uncertain dates but includes manually entered dates", () => {
    const shifts = [shift(), shift({ date: "2027-01-01", status: "uncertain" }), shift({ date: "2027-01-02", status: "manually_entered" }), shift({ date: "2027-01-03", finishTime: null })];
    expect(employeeHoursSummary(shifts)[0]).toMatchObject({ daysWorked: 2, reviewRows: 2 });
  });
});

describe("hours periods", () => {
  const shifts = [shift(), shift({ id: "new-year", date: "2027-01-01" })];

  test("weeks use Monday even across years", () => {
    expect(hoursPeriodKey("2027-01-03", "week")).toBe("2026-12-28");
    expect(hoursPeriodKey("2027-01-04", "week")).toBe("2027-01-04");
    expect(shiftsForPeriod(shifts, "week", "2026-12-28")).toHaveLength(2);
  });

  test("months and years use each shift's date, and all-time includes both", () => {
    expect(shiftsForPeriod(shifts, "day", "2027-01-01").map(shift => shift.id)).toEqual(["new-year"]);
    expect(shiftsForPeriod(shifts, "month", "2026-12")).toHaveLength(1);
    expect(shiftsForPeriod(shifts, "year", "2027")).toHaveLength(1);
    expect(employeeHoursSummary(shiftsForPeriod(shifts, "total", "total"))[0].minutes).toBe(900);
  });

  test("offers every day in loaded weeks, including days with no shifts", () => {
    expect(availableHoursPeriods(["2026-12-28"], shifts, "day")).toHaveLength(7);
    expect(availableHoursPeriods(["2026-12-28"], shifts, "month")).toEqual(["2027-01", "2026-12"]);
    expect(availableHoursPeriods([], [], "week")).toEqual([]);
  });

  test("paper coverage counts unique loaded dates and splits cross-year weeks by actual date", () => {
    const missing = ["2026-12-31", "2027-01-01", "2027-01-01"];
    const starts = ["2026-12-28", "2026-12-28"];
    expect(hoursPaperCoverage(starts, missing, "week", "2026-12-28").expectedDates).toHaveLength(7);
    expect(hoursPaperCoverage(starts, missing, "week", "2026-12-28").missingDates).toHaveLength(2);
    expect(hoursPaperCoverage(starts, missing, "month", "2026-12")).toMatchObject({ expectedDates: ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"], missingDates: ["2026-12-31"] });
    expect(hoursPaperCoverage(starts, missing, "year", "2027").expectedDates).toHaveLength(3);
    expect(hoursPaperCoverage(starts, missing, "day", "2027-01-01").missingDates).toEqual(["2027-01-01"]);
    expect(hoursPaperCoverage([], [], "total", "total")).toEqual({ expectedDates: [], missingDates: [] });
  });
});
