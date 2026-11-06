import { confirmedWorkedMinutes } from "./confirmed-hours";
import type { LocalWeek } from "./week-data";
import { missingDailySheetDates, weekDates } from "./week-coverage";

export type HoursView = "week" | "month" | "year";

export interface HoursPeriod {
  id: string;
  label: string;
  shortLabel: string;
  minutes: number;
  shifts: number;
  missingDates: string[];
  weekId?: string;
}

export function hoursHistory(weeks: LocalWeek[], view: HoursView, employeeId?: string): HoursPeriod[] {
  const periods = new Map<string, HoursPeriod>();
  const missingByPeriod = new Map<string, Set<string>>();
  const periodKey = (date: string) => view === "month" ? date.slice(0, 7) : date.slice(0, 4);
  function period(id: string, week: LocalWeek): HoursPeriod {
    let value = periods.get(id);
    if (!value) {
      const label = view === "week" ? `Week starting ${week.weekStarting}` : view === "year" ? id : new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${id}-01T00:00:00Z`));
      value = { id, label, shortLabel: view === "week" ? week.weekStarting.slice(5) : id, minutes: 0, shifts: 0, missingDates: [], ...(view === "week" ? { weekId: week.id } : {}) };
      periods.set(id, value);
      missingByPeriod.set(id, new Set());
    }
    return value;
  }
  for (const week of weeks) {
    if (!week.weekStarting) continue;
    const shifts = week.shifts.filter(shift => employeeId == null || shift.employeeId === employeeId);
    if (employeeId != null && shifts.length === 0) continue;
    const key = (date: string) => view === "week" ? week.weekStarting : periodKey(date);
    // Sheet coverage belongs to the sheet's calendar date, not the week's Monday.
    for (const date of weekDates(week.weekStarting)) period(key(date), week);
    for (const date of missingDailySheetDates(week)) missingByPeriod.get(key(date))!.add(date);
    for (const shift of shifts) {
      const minutes = confirmedWorkedMinutes(shift);
      if (minutes == null) continue;
      const value = period(key(shift.date), week);
      value.minutes += minutes;
      value.shifts += 1;
    }
  }
  return [...periods.values()]
    .map(value => ({ ...value, missingDates: [...missingByPeriod.get(value.id)!].sort() }))
    .filter(value => view !== "week" || employeeId == null || value.minutes > 0)
    .sort((a, b) => b.id.localeCompare(a.id));
}
