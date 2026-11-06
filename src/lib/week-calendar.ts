import type { LocalWeek } from "./week-data";
import { weekDates } from "./week-coverage";

export interface SheetDay {
  date: string;
  sheetCount: number;
  reviewRows: number;
  recordedRows: number;
}

export function calendarDays(week: LocalWeek): SheetDay[] {
  return weekDates(week.weekStarting).map(date => ({
    date,
    sheetCount: week.documents.filter(d => d.documentType === "daily_sheet" && d.documentDate === date).length,
    reviewRows: week.shifts.filter(s => s.date === date && (s.status === "uncertain" || s.status === "extracted")).length,
    recordedRows: week.shifts.filter(s => s.date === date && s.status !== "dismissed").length
  }));
}

export function isCalendarMonth(value: string) {
  return /^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) < 9999;
}

export function isCalendarYear(value: string) {
  return /^[1-9]\d{3}$/.test(value) && Number(value) < 9999;
}

export function yearWeekGroups<T extends { weekStarting: string; missingDailySheetDates: string[] }>(weeks: T[], year: string) {
  if (!isCalendarYear(year)) throw new Error("Year must be YYYY.");
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    // A cross-month week appears once, under the month its Monday falls in.
    const recorded = weeks.filter(week => week.weekStarting.startsWith(`${month}-`)).sort((a, b) => a.weekStarting.localeCompare(b.weekStarting));
    return { month, weeks: recorded, completeWeeks: recorded.filter(week => week.missingDailySheetDates.length === 0).length };
  });
}

export function monthWeeks(month: string) {
  if (!isCalendarMonth(month)) throw new Error("Month must be YYYY-MM.");
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const last = new Date(Date.UTC(year, number, 0));
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
  const rows: string[][] = [];
  while (first <= last) {
    rows.push(weekDates(first.toISOString().slice(0, 10)));
    first.setUTCDate(first.getUTCDate() + 7);
  }
  return rows;
}

export function adjacentMonth(month: string, offset: number) {
  if (!isCalendarMonth(month)) throw new Error("Month must be YYYY-MM.");
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function calendarDateLabel(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-AU", { ...options, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
