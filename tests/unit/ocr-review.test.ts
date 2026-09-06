import { describe, expect, test } from "vitest";
import { mergeOcrShifts } from "@/lib/merge-ocr-shifts";
import { applyShiftDismissal, applyShiftRestore } from "@/lib/shift-review-actions";
import { applyShiftUpdate } from "@/lib/shift-update-actions";
import { compareActualAndPaid, type ShiftInput } from "@/domain/reconciliation";
const doc = { id: "paper", filename: "paper.png" };
const row = (extra: Partial<ShiftInput> = {}): ShiftInput => ({ id: "ocr-paper-person", employeeId: "person", employeeName: "Fictional Person", date: "2026-07-06", startTime: "09:00", finishTime: "17:00", breakMinutes: 0, status: "uncertain", sourceDocument: doc.filename, sourceDocumentId: doc.id, sourceRowId: "3", ...extra });
const week = (shifts: ShiftInput[]) => ({ id: "week", weekStarting: "2026-07-06", status: "open", documents: [], photoAssignments: [], employees: [], payroll: [], reviewItems: [], shifts });
describe("rescan review safety", () => {
  test.each(["dismissed", "confirmed", "manually_entered"] as const)("preserves %s when OCR indexes change", (status) => {
    const existing = row({ status });
    expect(mergeOcrShifts([existing], [existing], doc, [row({ sourceRowId: "7", startTime: "10:00" })])).toEqual([existing]);
  });
  test("does not duplicate corrected rows or lose their nulls", () => {
    const corrected = applyShiftUpdate(week([row()]), { shiftId: row().id, startTime: null, finishTime: null, breakMinutes: null }).shifts[0];
    expect(mergeOcrShifts([corrected], [corrected], doc, [row({ sourceRowId: "10" })])).toEqual([corrected]);
  });
  test("preserves corrections made while extraction is running", () => {
    const baseline = row();
    const edited = row({ id: "manual-ocr-paper-person", startTime: "10:00" });
    expect(mergeOcrShifts([edited], [baseline], doc, [row()])).toEqual([edited]);
  });
  test("does not overwrite an uncertain row changed during OCR", () => {
    const changed = row({ startTime: "11:00" });
    expect(mergeOcrShifts([changed], [row()], doc, [row()])).toEqual([changed]);
  });
  test("renaming a paper does not invalidate protection", () => {
    const existing = row({ status: "dismissed" });
    expect(mergeOcrShifts([existing], [existing], { ...doc, filename: "renamed.png" }, [row()])).toEqual([existing]);
  });
  test("legacy filename-only corrected rows remain protected", () => {
    const existing = row({ id: "manual-row", sourceDocumentId: undefined });
    expect(mergeOcrShifts([existing], [existing], doc, [row()])).toEqual([existing]);
  });
  test("refreshes only unchanged unreviewed proposals and avoids duplicate ids", () => {
    const next = mergeOcrShifts([row()], [row()], doc, [row({ startTime: "10:00" }), row({ startTime: "11:00" })]);
    expect(next).toHaveLength(1); expect(next[0].startTime).toBe("10:00");
  });
  test("restoration retains dismissal history and survives rescanning", () => {
    const dismissed = applyShiftDismissal(week([row()]), row().id, "incorrect_ocr_row");
    const restored = applyShiftRestore(dismissed, row().id);
    expect(restored.shifts[0].reviewHistory?.map((event) => event.action)).toEqual(["dismiss", "restore"]);
    expect(mergeOcrShifts(restored.shifts, restored.shifts, doc, [row({ startTime: "12:00" })])).toEqual(restored.shifts);
    expect(compareActualAndPaid(restored.shifts, [])[0].actualTotalMinutes).toBe(0);
    expect(() => applyShiftUpdate(dismissed, { shiftId: row().id, startTime: null, finishTime: null, breakMinutes: null })).toThrow("Restore");
  });
});
