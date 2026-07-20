import { getAllWeekData, type LocalWeek } from "./week-data";
import { requireLocalDataMode } from "./data-mode";
import { getLocalWeeks, writeLocalWeek as saveLocalWeek, writeLocalWeeks } from "./local-sqlite-store";

export function readLocalWeek(): LocalWeek {
  requireLocalDataMode();
  const week = getAllWeekData()[0];
  if (!week) throw new Error("No local week data exists. Create a week before editing it.");
  return week;
}

export function writeLocalWeek(week: LocalWeek) {
  requireLocalDataMode();
  saveLocalWeek(week);
}

export function readLocalExtraWeeks(): LocalWeek[] {
  requireLocalDataMode();
  return getLocalWeeks().slice(1);
}

export function writeLocalExtraWeeks(weeks: LocalWeek[]) {
  requireLocalDataMode();
  const primary = readLocalWeek();
  writeLocalWeeks([primary, ...weeks]);
}

export function writeWeekById(weekId: string, updatedWeek: LocalWeek) {
  requireLocalDataMode();
  if (!getLocalWeeks().some((week) => week.id === weekId)) throw new Error("Week was not found.");
  saveLocalWeek(updatedWeek);
}
