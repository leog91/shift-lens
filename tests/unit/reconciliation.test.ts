import { describe, expect, test } from "vitest";
import { compareActualAndPaid, detectDuplicateShifts, invalidShiftReason, matchEmployeeName, parsePayslipHours, possibleTimeInterpretations, shiftDurationMinutes, sundayMinutes, workedMinutes, type PayrollInput, type ShiftInput } from "@/domain/reconciliation";
import { DailySheetExtractionSchema } from "@/extraction/schemas";
import { applyShiftUpdate } from "@/lib/shift-update-actions";
import { relinkPhotoPaths } from "@/lib/photo-organizer";
import { applyPhotoDocumentAssignment } from "@/lib/photo-actions";

const shift = (overrides: Partial<ShiftInput>): ShiftInput => ({ id: "s", employeeId: "e", employeeName: "Employee", date: "2026-07-06", startTime: "09:00", finishTime: "17:00", breakMinutes: 0, status: "confirmed", ...overrides });
const payroll = (overrides: Partial<PayrollInput>): PayrollInput => ({ employeeId: "e", employeeName: "Employee", ordinaryPaidMinutes: 480, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: 480, ...overrides });

describe("reconciliation domain", () => {
  test("normal shift with no break", () => expect(workedMinutes("09:00", "17:00", 0)).toBe(480));
  test("normal shift with a break", () => expect(workedMinutes("09:00", "17:00", 30)).toBe(450));
  test("overnight shift", () => expect(workedMinutes("18:00", "01:00", 30)).toBe(390));
  test("multiple shifts on the same day", () => expect(compareActualAndPaid([shift({ id: "a", startTime: "09:00", finishTime: "12:00" }), shift({ id: "b", startTime: "13:00", finishTime: "18:00" })], [payroll({})])[0].actualTotalMinutes).toBe(480));
  test("split shift", () => expect(compareActualAndPaid([shift({ id: "a", startTime: "09:00", finishTime: "12:00" }), shift({ id: "b", startTime: "18:00", finishTime: "22:00" })], [payroll({ displayedTotalPaidMinutes: 420, ordinaryPaidMinutes: 420 })])[0].status).toBe("matches"));
  test("Saturday-to-Sunday shift", () => expect(sundayMinutes("2026-07-11", "22:00", "02:00")).toBe(120));
  test("Sunday-to-Monday shift", () => expect(sundayMinutes("2026-07-12", "22:00", "02:00")).toBe(120));
  test("Monday shift has no Sunday minutes regardless of server timezone", () => expect(sundayMinutes("2026-06-29", "09:00", "17:00")).toBe(0));
  test("reconciliation separates weekday and Sunday actual minutes", () => {
    const result = compareActualAndPaid([
      shift({ id: "weekday", date: "2026-07-06", startTime: "09:00", finishTime: "17:00" }),
      shift({ id: "sunday", date: "2026-07-12", startTime: "09:00", finishTime: "13:00" })
    ], [payroll({ ordinaryPaidMinutes: 480, sundayPaidMinutes: 240, displayedTotalPaidMinutes: 720 })])[0];
    expect(result.actualWeekdayMinutes).toBe(480);
    expect(result.actualSundayMinutes).toBe(240);
    expect(result.actualTotalMinutes).toBe(720);
    expect(result.paidWeekdayMinutes).toBe(480);
    expect(result.paidSundayMinutes).toBe(240);
  });
  test("uncertain shift excluded from confirmed totals", () => expect(compareActualAndPaid([shift({ status: "uncertain" })], [payroll({})])[0].actualTotalMinutes).toBe(0));
  test("manually entered shift is included in confirmed totals", () => expect(compareActualAndPaid([shift({ status: "manually_entered", breakMinutes: 30 })], [payroll({ ordinaryPaidMinutes: 450, displayedTotalPaidMinutes: 450 })])[0]).toMatchObject({ actualTotalMinutes: 450, status: "matches" }));
  test("exact actual-versus-paid match", () => expect(compareActualAndPaid([shift({})], [payroll({})])[0].status).toBe("matches"));
  test("actual greater than paid", () => expect(compareActualAndPaid([shift({})], [payroll({ displayedTotalPaidMinutes: 420, ordinaryPaidMinutes: 420 })])[0].status).toBe("possible_missing_hours"));
  test("paid greater than actual", () => expect(compareActualAndPaid([shift({})], [payroll({ displayedTotalPaidMinutes: 540, ordinaryPaidMinutes: 540 })])[0].status).toBe("possible_extra_paid_hours"));
  test("total match with Sunday-category mismatch", () => expect(compareActualAndPaid([shift({ date: "2026-07-12" })], [payroll({ ordinaryPaidMinutes: 480, sundayPaidMinutes: 0 })])[0].status).toBe("needs_review"));
  test("employee without payroll", () => expect(compareActualAndPaid([shift({})], [])[0].status).toBe("payroll_unavailable"));
  test("employee alias matching", () => expect(matchEmployeeName("Anna", [{ employeeId: "e", displayName: "Ana Byrne", aliases: ["Anna"] }]).reviewRequired).toBe(false));
  test("ambiguous time parsing", () => expect(possibleTimeInterpretations("3", "start").map((x) => x.value)).toEqual(["03:00", "15:00"]));
  test("decimal payslip-hour parsing", () => expect(parsePayslipHours("7.5").minutes).toBe(450));
  test("two-decimal payslip hours round to whole minutes", () => expect(parsePayslipHours("24.08")).toEqual({ minutes: 1445, reviewRequired: false, reason: null }));
  test("manually corrected OCR rows are retained for future rescans", () => {
    const updated = applyShiftUpdate({
      id: "week",
      weekStarting: "2026-07-06",
      status: "needs_review",
      documents: [],
      photoAssignments: [],
      employees: [],
      shifts: [shift({ id: "ocr-doc-employee", status: "uncertain" })],
      payroll: [],
      reviewItems: []
    }, { shiftId: "ocr-doc-employee", startTime: "09:00", finishTime: "17:00", breakMinutes: 0 });
    expect(updated.shifts[0]).toMatchObject({ id: "manual-ocr-doc-employee", status: "uncertain" });
  });
  test("organizing originals relinks documents and OCR source names", () => {
    const updated = relinkPhotoPaths({
      id: "week",
      weekStarting: "2026-07-06",
      status: "needs_review",
      documents: [{ id: "doc", documentType: "daily_sheet", documentDate: "2026-07-06", filename: "original.jpeg", path: "photo-inbox/original.jpeg", qualityWarnings: [] }],
      photoAssignments: [],
      employees: [],
      shifts: [shift({ sourceDocument: "original.jpeg" })],
      payroll: [],
      reviewItems: []
    }, new Map([["photo-inbox/original.jpeg", "photo-inbox/organized/2026-07-06/2026-07-06--daily-sheet.jpeg"]]));
    expect(updated.documents[0]).toMatchObject({ filename: "2026-07-06--daily-sheet.jpeg", path: "photo-inbox/organized/2026-07-06/2026-07-06--daily-sheet.jpeg" });
    expect(updated.shifts[0].sourceDocument).toBe("2026-07-06--daily-sheet.jpeg");
  });
  test("reassigning a document removes its old evidence assignment", () => {
    const updated = applyPhotoDocumentAssignment([{ id: "old", weekStarting: "2026-07-06", status: "needs_review", documents: [], photoAssignments: [{ path: "photo-inbox/manual-review/photo.jpeg", weekStarting: "2026-07-06", documentType: "unknown", documentDate: null, note: null }], employees: [], shifts: [], payroll: [], reviewItems: [] }], { path: "photo-inbox/manual-review/photo.jpeg", weekStarting: "2026-07-06", documentType: "daily_sheet", documentDate: "2026-07-06", note: null });
    expect(updated[0].photoAssignments).toEqual([]);
    expect(updated[0].documents).toHaveLength(1);
  });
  test("invalid break larger than shift", () => expect(invalidShiftReason(shift({ breakMinutes: 600 }))).toBe("Break is larger than shift duration."));
  test("duplicate-shift detection", () => expect(detectDuplicateShifts([shift({ id: "a" }), shift({ id: "b" })])).toHaveLength(1));
  test("reconciliation-status assignment", () => expect(compareActualAndPaid([shift({ status: "uncertain" })], [payroll({})])[0].status).toBe("needs_review"));
  test("extraction-response Zod validation", () => expect(DailySheetExtractionSchema.parse({ documentType: "daily_sheet", date: null, providerName: "test", qualityWarnings: [], detectedText: [], rows: [], unresolvedFields: [] }).documentType).toBe("daily_sheet"));
  test("shift duration raw overnight", () => expect(shiftDurationMinutes("23:00", "01:00")).toBe(120));
});
