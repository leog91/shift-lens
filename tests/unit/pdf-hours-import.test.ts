import { expect, test } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { closeLocalDatabase, getLocalWeeks, writeLocalWeek } from "@/lib/local-sqlite-store";

test("PDF import is resumable, preserves existing hours, and refreshes only disposable proposals", () => {
  // Playwright clears test-results at startup; unit fixtures must not live there.
  mkdirSync("extracted/test-fixtures", { recursive: true });
  const temporary = mkdtempSync(resolve("extracted/test-fixtures/pdf-fictional-"));
  const profile = join(temporary, "profile");
  const directory = join(profile, "photo-inbox", `pdf-${"a".repeat(64)}`);
  const previousProfile = process.env.SHIFT_LENS_PROFILE_DIR;
  process.env.SHIFT_LENS_PROFILE_DIR = profile;
  try {
    mkdirSync(join(profile, "data"), { recursive: true });
    mkdirSync(join(directory, "ocr"), { recursive: true });
    const database = new Database(join(profile, "data/shiftlens.sqlite"));
    database.exec("CREATE TABLE companies (id TEXT PRIMARY KEY, business_name TEXT, schema_version INTEGER); INSERT INTO companies VALUES ('fictional', 'Fictional', 1)");
    database.close();
    const employees = ["Ana", "Beatrice"].map(displayName => ({ id: displayName.toLowerCase(), displayName, aliases: [] }));
    writeLocalWeek({ id: "fictional-week", weekStarting: "2026-03-23", status: "open", photoAssignments: [], documents: [], employees, payroll: [], reviewItems: [], shifts: [
      { id: "manual-ana", employeeId: "ana", employeeName: "Ana", date: "2026-03-24", startTime: "08:00", finishTime: "16:00", breakMinutes: 30, status: "manually_entered" }
    ] });
    closeLocalDatabase();
    writeFileSync(join(directory, "manifest.json"), JSON.stringify({ sha256: "a".repeat(64), pages: [{ page: 1, filename: "page-001.png" }, { page: 2, filename: "page-002.png" }] }));
    const value = (rawValue: string, minutes: number | null = null) => ({ rawValue, minutes, confidence: .9, boundingBox: null });
    const checkpoint = { date: "2026-03-24", rawDate: "Tuesday 24 March", imageWidth: 100, imageHeight: 100, rows: employees.map((e, rowIndex) => ({ rowIndex, rawEmployeeName: e.displayName, matchedEmployeeId: e.id, matchedEmployeeName: e.displayName, employeeMatchConfidence: 1, employeeBoundingBox: null, start: value("09:00"), finish: value("17:00"), break: value("?"), reviewReasons: [] })) };
    writeFileSync(join(directory, "ocr/page-001.json"), JSON.stringify(checkpoint));
    writeFileSync(join(directory, "ocr/page-002.json"), JSON.stringify({ ...checkpoint, date: null }));
    const bundle = join(temporary, "import.mjs");
    execFileSync("bun", ["build", "scripts/import-pdf-hours.ts", "--target=node", "--packages=external", `--outfile=${bundle}`]);
    const run = (mode = "--apply") => JSON.parse(execFileSync(process.execPath, [bundle, directory, mode], { encoding: "utf8", env: { ...process.env, SHIFT_LENS_DATA_MODE: "local" } }));
    expect(run()).toMatchObject({ importedDocuments: 1, importedRows: 1, preservedExistingRows: 1, pendingPages: [2] });
    expect(run()).toMatchObject({ importedDocuments: 0, importedRows: 0 });
    let week = getLocalWeeks()[0];
    expect(week.shifts).toHaveLength(2);
    expect(week.shifts.find(s => s.employeeId === "ana")).toMatchObject({ startTime: "08:00", status: "manually_entered" });
    const proposal = week.shifts.find(s => s.employeeId === "beatrice")!;
    expect(proposal).toMatchObject({ status: "uncertain", breakMinutes: null, extraction: { rawBreak: "?", rawDate: "Tuesday 24 March" } });
    proposal.startTime = "10:00";
    proposal.status = "confirmed";
    writeLocalWeek(week);
    closeLocalDatabase();
    run("--refresh-proposals");
    week = getLocalWeeks()[0];
    expect(week.shifts.find(s => s.employeeId === "beatrice")).toMatchObject({ startTime: "10:00", status: "confirmed" });
    expect(week.shifts).toHaveLength(2);
    expect(readFileSync(join(directory, "manifest.json"), "utf8")).toContain("page-001.png");
  } finally {
    closeLocalDatabase();
    if (previousProfile === undefined) delete process.env.SHIFT_LENS_PROFILE_DIR;
    else process.env.SHIFT_LENS_PROFILE_DIR = previousProfile;
    rmSync(temporary, { recursive: true, force: true });
  }
});
