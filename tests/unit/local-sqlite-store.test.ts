import { describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { closeLocalDatabase, getLocalWeeks, writeLocalWeek } from "@/lib/local-sqlite-store";

describe("local SQLite OCR review persistence", () => {
  test("migrates and round-trips provenance, corrections, and dismissal", () => {
    const profile = mkdtempSync(join(tmpdir(), "shiftlens-fictional-"));
    const previous = process.env.SHIFT_LENS_PROFILE_DIR;
    process.env.SHIFT_LENS_PROFILE_DIR = profile;
    mkdirSync(join(profile, "data"), { recursive: true });
    const database = new Database(join(profile, "data", "shiftlens.sqlite"));
    database.exec("CREATE TABLE companies (id TEXT PRIMARY KEY NOT NULL, business_name TEXT NOT NULL, schema_version INTEGER NOT NULL); INSERT INTO companies VALUES ('fictional-company', 'Fictional Company', 1)");
    database.exec("CREATE TABLE local_shifts (id TEXT PRIMARY KEY NOT NULL, week_id TEXT NOT NULL, employee_id TEXT NOT NULL, employee_name TEXT NOT NULL, date TEXT NOT NULL, start_time TEXT, finish_time TEXT, break_minutes INTEGER, status TEXT NOT NULL, source_document TEXT); INSERT INTO local_shifts VALUES ('legacy', 'legacy-week', 'e', 'Fictional Employee', '2026-07-06', '09:00', '17:00', 0, 'confirmed', 'old.jpg'); CREATE TABLE local_weeks (id TEXT PRIMARY KEY NOT NULL, company_id TEXT NOT NULL, week_starting TEXT NOT NULL, status TEXT NOT NULL); INSERT INTO local_weeks VALUES ('legacy-week', 'fictional-company', '2026-07-06', 'open');");
    database.close();
    try {
      writeLocalWeek({
        id: "fictional-week", weekStarting: "2026-07-06", status: "open", documents: [{ id: "fictional-paper", documentType: "daily_sheet", documentDate: "2026-07-06", filename: "fictional-paper.jpg", path: "photo-inbox/fictional-paper.jpg", qualityWarnings: [] }], photoAssignments: [], employees: [], payroll: [], reviewItems: [], shifts: [{
          id: "ocr-fictional-row", employeeId: "fictional-employee", employeeName: "Fictional Employee", date: "2026-07-06", startTime: null, finishTime: "17:00", breakMinutes: null, status: "dismissed", reviewHistory: [{ action: "dismiss", reason: "incorrect_ocr_row", timestamp: "2026-07-06T12:02:00.000Z", reviewer: null }], sourceDocument: "fictional-paper.jpg", sourceDocumentId: "fictional-paper", sourceRowId: "3", uncertainFields: ["startTime", "breakMinutes"], extraction: { providerName: "fixture", extractedAt: "2026-07-06T12:00:00.000Z", rawEmployeeName: "Fictional Employee", rawDate: null, rawStartTime: null, rawFinishTime: "17:00", rawBreak: "?", confidences: { employee: 0.9, start: null, finish: 0.9, break: 0.1 }, coordinates: { employee: null, start: null, finish: { x: 100, y: 200, width: 30, height: 10 }, break: null } }, corrections: [{ previousValue: { startTime: "09:00", finishTime: "17:00", breakMinutes: 30 }, newValue: { startTime: null, finishTime: "17:00", breakMinutes: null }, timestamp: "2026-07-06T12:01:00.000Z", reason: "Fictional review", reviewer: null }], dismissal: { reason: "incorrect_ocr_row", timestamp: "2026-07-06T12:02:00.000Z", reviewer: null }
        }]
      });
      closeLocalDatabase();
      expect(getLocalWeeks().find((week) => week.id === "legacy-week")?.shifts[0]).toMatchObject({ startTime: "09:00", status: "confirmed", extraction: null, corrections: [], reviewHistory: [] });
      const stored = getLocalWeeks().find((week) => week.id === "fictional-week")?.shifts[0];
      expect(stored).toMatchObject({ status: "dismissed", sourceDocumentId: "fictional-paper", sourceRowId: "3", uncertainFields: ["startTime", "breakMinutes"], dismissal: { reason: "incorrect_ocr_row" } });
      expect(stored?.reviewHistory?.[0].action).toBe("dismiss");
      expect(stored?.extraction?.rawBreak).toBe("?");
      expect(stored?.corrections?.[0].reason).toBe("Fictional review");
    } finally {
      closeLocalDatabase();
      if (previous === undefined) delete process.env.SHIFT_LENS_PROFILE_DIR;
      else process.env.SHIFT_LENS_PROFILE_DIR = previous;
      rmSync(profile, { recursive: true, force: true });
    }
  });
});
