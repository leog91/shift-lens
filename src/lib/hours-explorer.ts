import type { ShiftInput } from "@/domain/reconciliation";
import { weekDates } from "./week-coverage";

export type HoursPeriodView = "day" | "week" | "month" | "year" | "total";

export function hoursPeriodKey(date: string, view: HoursPeriodView): string {
  if (view === "total") return "total";
  if (view === "month") return date.slice(0, 7);
  if (view === "year") return date.slice(0, 4);
  if (view === "week") {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
    return day.toISOString().slice(0, 10);
  }
  return date;
}

export function shiftsForPeriod(shifts: ShiftInput[], view: HoursPeriodView, key: string) {
  return shifts.filter(shift => view === "total" || hoursPeriodKey(shift.date, view) === key);
}

export function availableHoursPeriods(weekStarts: string[], shifts: ShiftInput[], view: HoursPeriodView) {
  const dates = [...weekStarts.flatMap(weekDates), ...shifts.map(shift => shift.date)];
  return [...new Set(dates.map(date => hoursPeriodKey(date, view)))].sort().reverse();
}

export function hoursPaperCoverage(weekStarts: string[], missingDates: string[], view: HoursPeriodView, key: string) {
  const expectedDates = [...new Set(weekStarts.flatMap(weekDates))]
    .filter(date => view === "total" || hoursPeriodKey(date, view) === key).sort();
  const missing = new Set(missingDates);
  return { expectedDates, missingDates: expectedDates.filter(date => missing.has(date)) };
}
