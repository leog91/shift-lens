import { hoursPeriodKey, type HoursPeriodView } from "../hours-explorer";
import type { PublishedSnapshot } from "../sync/projection";

export type PublishedWeek = PublishedSnapshot["weeks"][number];
export type PublishedShift = PublishedWeek["shifts"][number];
export type DashboardView = "weeks" | "hours" | "employees" | "payroll";
export const dashboardViews: { value: DashboardView; label: string }[] = [
  { value: "weeks", label: "Weeks" }, { value: "hours", label: "Hours" },
  { value: "employees", label: "Employees" }, { value: "payroll", label: "Paid hours" }
];
export const dashboardPeriods: { value: HoursPeriodView; label: string }[] = [
  { value: "day", label: "Day" }, { value: "week", label: "Week" },
  { value: "month", label: "Month" }, { value: "year", label: "Year" }, { value: "total", label: "All time" }
];

export function dashboardUrl(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  return `/dashboard${params.size ? `?${params}` : ""}`;
}

export function publishedEmployees(weeks: PublishedWeek[]) {
  const people = new Map<string, { id: string; name: string }>();
  // Prefer the most recent verified display name; never expose local aliases.
  for (const week of [...weeks].sort((a, b) => a.weekStarting.localeCompare(b.weekStarting))) {
    for (const entry of [...week.shifts, ...week.payroll]) people.set(entry.employeeId, { id: entry.employeeId, name: entry.employeeName });
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function publishedPeriods(weeks: PublishedWeek[], view: HoursPeriodView) {
  if (view === "total") return ["total"];
  const dates = [...weeks.map(week => week.weekStarting), ...weeks.flatMap(week => week.shifts.map(shift => shift.date))];
  return [...new Set(dates.map(date => hoursPeriodKey(date, view)))].sort().reverse();
}

export function publishedPeriodLabel(key: string, view: HoursPeriodView) {
  if (!key) return "No synced periods";
  if (view === "total") return "All synced records";
  if (view === "week") return `Week starting ${key}`;
  if (view === "year") return key;
  return new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", ...(view === "month" ? { month: "long", year: "numeric" } : { weekday: "short", day: "numeric", month: "short", year: "numeric" }) })
    .format(new Date(`${key}${view === "month" ? "-01" : ""}T00:00:00Z`));
}

export function publishedShiftsForPeriod(weeks: PublishedWeek[], view: HoursPeriodView, key: string) {
  return weeks.flatMap(week => week.shifts).filter(shift => view === "total" || hoursPeriodKey(shift.date, view) === key)
    .sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName) || a.id.localeCompare(b.id));
}

export function publishedHoursRanking(shifts: PublishedShift[]) {
  const people = new Map<string, { employeeId: string; employeeName: string; workedMinutes: number; shiftCount: number; dates: Set<string> }>();
  for (const shift of shifts) {
    const person = people.get(shift.employeeId) ?? { employeeId: shift.employeeId, employeeName: shift.employeeName, workedMinutes: 0, shiftCount: 0, dates: new Set<string>() };
    person.workedMinutes += shift.workedMinutes;
    person.shiftCount++;
    person.dates.add(shift.date);
    people.set(shift.employeeId, person);
  }
  const sorted = [...people.values()].sort((a, b) => b.workedMinutes - a.workedMinutes || a.employeeName.localeCompare(b.employeeName) || a.employeeId.localeCompare(b.employeeId));
  let rank = 0;
  return sorted.map((person, index) => {
    if (index === 0 || person.workedMinutes !== sorted[index - 1].workedMinutes) rank = index + 1;
    const dates = [...person.dates].sort();
    return { employeeId: person.employeeId, employeeName: person.employeeName, workedMinutes: person.workedMinutes,
      shifts: person.shiftCount, daysWorked: dates.length, firstDate: dates[0], lastDate: dates.at(-1)!, rank };
  });
}

export function publishedHoursHistory(shifts: PublishedShift[], view: HoursPeriodView) {
  const periods = new Map<string, { key: string; workedMinutes: number; shifts: number; dates: Set<string> }>();
  for (const shift of shifts) {
    const key = hoursPeriodKey(shift.date, view);
    const period = periods.get(key) ?? { key, workedMinutes: 0, shifts: 0, dates: new Set<string>() };
    period.workedMinutes += shift.workedMinutes;
    period.shifts++;
    period.dates.add(shift.date);
    periods.set(key, period);
  }
  return [...periods.values()].sort((a, b) => b.key.localeCompare(a.key)).map(period => ({
    key: period.key, label: publishedPeriodLabel(period.key, view), workedMinutes: period.workedMinutes,
    shifts: period.shifts, daysWorked: period.dates.size
  }));
}

export function publishedWeekComparison(week: PublishedWeek) {
  const actual = new Map(publishedHoursRanking(week.shifts).map(person => [person.employeeId, person]));
  const payroll = new Map(week.payroll.map(entry => [entry.employeeId, entry]));
  return publishedEmployees([week]).map(person => {
    const work = actual.get(person.id);
    const pay = payroll.get(person.id);
    return { employeeId: person.id, employeeName: person.name,
      workedMinutes: work?.workedMinutes ?? null, paidMinutes: pay?.totalPaidMinutes ?? null,
      daysWorked: work?.daysWorked ?? null, shifts: work?.shifts ?? null,
      differenceMinutes: work && pay ? work.workedMinutes - pay.totalPaidMinutes : null,
      payroll: pay ?? null
    };
  });
}

export function publishedSubtotal(shifts: PublishedShift[]) {
  return shifts.length ? shifts.reduce((total, shift) => total + shift.workedMinutes, 0) : null;
}

export function resolveDashboardSelection(weeks: PublishedWeek[], query: Record<string, string | string[] | undefined>) {
  const value = (name: string) => typeof query[name] === "string" ? query[name] as string : "";
  const view = dashboardViews.find(option => option.value === value("view"))?.value ?? "weeks";
  const period = dashboardPeriods.find(option => option.value === value("period"))?.value ?? (view === "employees" ? "month" : "week");
  const employees = publishedEmployees(weeks);
  const employeeId = employees.some(person => person.id === value("employee")) ? value("employee") : "";
  const sortedWeeks = [...weeks].sort((a, b) => b.weekStarting.localeCompare(a.weekStarting) || a.id.localeCompare(b.id));
  const preferredWeek = sortedWeeks.find(week => week.shifts.length || week.payroll.length) ?? sortedWeeks[0];
  const week = sortedWeeks.find(week => week.id === value("week")) ?? preferredWeek ?? null;
  const periods = publishedPeriods(weeks, period);
  const latestShift = weeks.flatMap(week => week.shifts).sort((a, b) => b.date.localeCompare(a.date))[0];
  const preferredKey = latestShift ? hoursPeriodKey(latestShift.date, period) : periods[0] ?? "";
  const key = periods.includes(value("key")) ? value("key") : preferredKey;
  return { view, period, key, employeeId, employees, weeks: sortedWeeks, week, periods };
}
