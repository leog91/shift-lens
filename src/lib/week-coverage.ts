import type { LocalWeek } from "./week-data";

export function weekDates(weekStarting: string) {
  const [year, month, day] = weekStarting.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  });
}

export function missingDailySheetDates(week: LocalWeek) {
  const actualDates = new Set(week.documents.filter((document) => document.documentType === "daily_sheet" && document.documentDate).map((document) => document.documentDate));
  return weekDates(week.weekStarting).filter((date) => !actualDates.has(date));
}
