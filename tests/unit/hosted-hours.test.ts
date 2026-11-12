import { describe, expect, test } from "vitest";
import {
  dashboardUrl, publishedEmployees, publishedHoursHistory, publishedHoursRanking,
  publishedPeriods, publishedShiftsForPeriod, publishedSubtotal, publishedWeekComparison,
  resolveDashboardSelection, type PublishedWeek
} from "@/lib/hosted/hours";

const shift = (id: string, employeeId: string, date: string, workedMinutes: number) => ({
  id, employeeId, employeeName: employeeId === "alex" ? "Alex Example" : "Casey Sample", date, workedMinutes
});
const weeks: PublishedWeek[] = [
  { id: "june", weekStarting: "2026-06-29", shifts: [shift("a", "alex", "2026-06-30", 120), shift("b", "alex", "2026-06-30", 60), shift("c", "casey", "2026-07-01", 180)], payroll: [
    { employeeId: "alex", employeeName: "Alex Example", ordinaryPaidMinutes: 120, sundayPaidMinutes: 30, otherPaidMinutes: 0, totalPaidMinutes: 150 }
  ] },
  { id: "july", weekStarting: "2026-07-06", shifts: [shift("d", "alex", "2026-07-06", 60)], payroll: [] },
  { id: "empty", weekStarting: "2026-07-13", shifts: [], payroll: [] }
];

describe("private dashboard verified-data views", () => {
  test("split shifts count once per day, ties share rank, and filtering preserves rank", () => {
    const ranked = publishedHoursRanking(weeks[0].shifts);
    expect(ranked.map(person => [person.employeeId, person.rank, person.workedMinutes, person.daysWorked, person.shifts]))
      .toEqual([["alex", 1, 180, 1, 2], ["casey", 1, 180, 1, 1]]);
    const all = publishedHoursRanking(weeks.flatMap(week => week.shifts));
    expect(all.find(person => person.employeeId === "casey")?.rank).toBe(2);
  });
  test("calendar months use shift dates rather than the source week's Monday", () => {
    expect(publishedSubtotal(publishedShiftsForPeriod(weeks, "month", "2026-06"))).toBe(180);
    expect(publishedSubtotal(publishedShiftsForPeriod(weeks, "month", "2026-07"))).toBe(240);
    expect(publishedSubtotal(publishedShiftsForPeriod(weeks, "week", "2026-06-29"))).toBe(360);
    expect(publishedSubtotal(publishedShiftsForPeriod(weeks, "day", "2026-06-30"))).toBe(180);
    expect(publishedSubtotal(publishedShiftsForPeriod(weeks, "year", "2026"))).toBe(420);
  });
  test("history groups verified rows deterministically and does not invent absent zero periods", () => {
    expect(publishedHoursHistory(weeks.flatMap(week => week.shifts), "month")).toEqual([
      { key: "2026-07", label: "July 2026", workedMinutes: 240, shifts: 2, daysWorked: 2 },
      { key: "2026-06", label: "June 2026", workedMinutes: 180, shifts: 2, daysWorked: 1 }
    ]);
    expect(publishedHoursHistory([], "week")).toEqual([]);
    expect(publishedSubtotal([])).toBeNull();
  });
  test("missing payroll stays null, not zero or a fabricated difference", () => {
    expect(publishedWeekComparison(weeks[0])).toMatchObject([
      { employeeId: "alex", workedMinutes: 180, paidMinutes: 150, differenceMinutes: 30 },
      { employeeId: "casey", workedMinutes: 180, paidMinutes: null, differenceMinutes: null }
    ]);
    const payOnly = { ...weeks[0], shifts: [] };
    expect(publishedWeekComparison(payOnly)[0]).toMatchObject({ workedMinutes: null, paidMinutes: 150, differenceMinutes: null });
  });
  test("explicitly verified zero-minute values remain real zero values", () => {
    const zero = { ...weeks[0], shifts: [shift("z", "alex", "2026-06-30", 0)], payroll: [{ ...weeks[0].payroll[0], ordinaryPaidMinutes: 0, sundayPaidMinutes: 0, totalPaidMinutes: 0 }] };
    expect(publishedWeekComparison(zero)[0]).toMatchObject({ workedMinutes: 0, paidMinutes: 0, differenceMinutes: 0, daysWorked: 1 });
    expect(publishedSubtotal(zero.shifts)).toBe(0);
  });
  test("periods include empty source weeks for browsing, but defaults prefer verified data", () => {
    expect(publishedPeriods(weeks, "week")).toEqual(["2026-07-13", "2026-07-06", "2026-06-29"]);
    const selection = resolveDashboardSelection(weeks, {});
    expect(selection.week?.id).toBe("july");
    expect(selection.key).toBe("2026-07-06");
    expect(resolveDashboardSelection(weeks, { week: "empty" }).week?.id).toBe("empty");
  });
  test("invalid query values safely fall back to known options", () => {
    const selection = resolveDashboardSelection(weeks, { view: "documents", employee: "unknown", period: "invalid", key: "not-a-date", week: "not-a-week" });
    expect(selection).toMatchObject({ view: "weeks", period: "week", employeeId: "", key: "2026-07-06" });
    expect(resolveDashboardSelection(weeks, { view: ["hours", "payroll"] }).view).toBe("weeks");
    expect(resolveDashboardSelection([], {})).toMatchObject({ week: null, employeeId: "", key: "" });
  });
  test("employees include paid-only records and names follow the latest verified data", () => {
    const renamed = { ...weeks[1], shifts: [{ ...weeks[1].shifts[0], employeeName: "Alex Renamed" }] };
    expect(publishedEmployees([weeks[0], renamed])[0]).toEqual({ id: "alex", name: "Alex Renamed" });
    expect(publishedEmployees([{ ...weeks[0], shifts: [] }])).toHaveLength(1);
  });
  test("URLs stay on the private dashboard and encode filter values", () => {
    const url = dashboardUrl({ view: "employees", employee: "test&view=documents", key: "" });
    expect(url).toBe("/dashboard?view=employees&employee=test%26view%3Ddocuments");
    expect(dashboardUrl({})).toBe("/dashboard");
  });
});
