import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getWeekData, type LocalWeek } from "./week-data";
import { localProfilePath } from "./local-profile";
import { requireLocalDataMode } from "./data-mode";

export function localWeekPath() {
  return localProfilePath("data", "local-week.json");
}

export function localExtraWeeksPath() {
  return localProfilePath("data", "local-extra-weeks.json");
}

export function readLocalWeek(): LocalWeek {
  requireLocalDataMode();
  const path = localWeekPath();
  if (!existsSync(path)) throw new Error("No local week data file exists.");
  return getWeekData();
}

export function writeLocalWeek(week: LocalWeek) {
  requireLocalDataMode();
  writeFileSync(localWeekPath(), `${JSON.stringify(week, null, 2)}\n`);
}

export function readLocalExtraWeeks(): LocalWeek[] {
  requireLocalDataMode();
  const path = localExtraWeeksPath();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as LocalWeek[];
}

export function writeLocalExtraWeeks(weeks: LocalWeek[]) {
  requireLocalDataMode();
  writeFileSync(localExtraWeeksPath(), `${JSON.stringify(weeks, null, 2)}\n`);
}

export function writeWeekById(weekId: string, updatedWeek: LocalWeek) {
  requireLocalDataMode();
  const primary = readLocalWeek();
  if (primary.id === weekId) {
    writeLocalWeek(updatedWeek);
    return;
  }
  const extraWeeks = readLocalExtraWeeks();
  if (!extraWeeks.some((week) => week.id === weekId)) throw new Error("Week was not found.");
  writeLocalExtraWeeks(extraWeeks.map((week) => week.id === weekId ? updatedWeek : week));
}

export function readRawLocalWeek() {
  requireLocalDataMode();
  return JSON.parse(readFileSync(localWeekPath(), "utf8")) as LocalWeek;
}
