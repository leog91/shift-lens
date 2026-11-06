import { z } from "zod";
import type { PayrollInput, ShiftInput } from "@/domain/reconciliation";
import { missingDailySheetDates } from "./week-coverage";
import { isLocalDataMode } from "./data-mode";
import { getDemoWeeks } from "@/demo/database";
import { getLocalWeeks } from "./local-sqlite-store";
import { calendarDays } from "./week-calendar";

const LocalDocumentSchema = z.object({
  id: z.string(),
  documentType: z.enum(["daily_sheet", "roster", "payslip"]),
  documentDate: z.string().nullable(),
  filename: z.string(),
  path: z.string(),
  qualityWarnings: z.array(z.string()).default([])
});

const PhotoAssignmentSchema = z.object({
  path: z.string(),
  weekStarting: z.string(),
  documentType: z.enum(["daily_sheet", "roster", "payslip", "unknown"]),
  documentDate: z.string().nullable(),
  note: z.string().nullable().default(null)
});

const LocalWeekSchema = z.object({
  id: z.string(),
  weekStarting: z.string(),
  status: z.string(),
  documents: z.array(LocalDocumentSchema),
  photoAssignments: z.array(PhotoAssignmentSchema).default([]),
  employees: z.array(z.object({ id: z.string(), displayName: z.string(), aliases: z.array(z.string()).default([]) })),
  shifts: z.array(z.object({
    id: z.string(),
    employeeId: z.string(),
    employeeName: z.string(),
    date: z.string(),
    startTime: z.string().nullable(),
    finishTime: z.string().nullable(),
    breakMinutes: z.number().int().nullable(),
    status: z.enum(["extracted", "confirmed", "uncertain", "manually_entered", "dismissed"]),
    sourceDocument: z.string().nullable().optional(),
    sourceDocumentId: z.string().nullable().optional(),
    sourceRowId: z.string().nullable().optional(),
    uncertainFields: z.array(z.string()).optional(),
    extraction: z.object({
      imageWidth: z.number().positive().nullable().optional(), imageHeight: z.number().positive().nullable().optional(),
      providerName: z.string(), extractedAt: z.string(), rawEmployeeName: z.string().nullable(), rawDate: z.string().nullable(), rawStartTime: z.string().nullable(), rawFinishTime: z.string().nullable(), rawBreak: z.string().nullable(),
      confidences: z.object({ employee: z.number().nullable(), start: z.number().nullable(), finish: z.number().nullable(), break: z.number().nullable() }),
      coordinates: z.object({ employee: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable(), start: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable(), finish: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable(), break: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable() })
    }).nullable().optional(),
    corrections: z.array(z.object({ previousValue: z.object({ startTime: z.string().nullable(), finishTime: z.string().nullable(), breakMinutes: z.number().int().nullable() }), newValue: z.object({ startTime: z.string().nullable(), finishTime: z.string().nullable(), breakMinutes: z.number().int().nullable() }), timestamp: z.string(), reason: z.string(), reviewer: z.string().nullable() })).optional(),
    reviewHistory: z.array(z.object({ action: z.enum(["dismiss", "restore"]), reason: z.enum(["not_worked", "incorrect_ocr_row"]), timestamp: z.string(), reviewer: z.string().nullable() })).optional(),
    dismissal: z.object({ reason: z.enum(["not_worked", "incorrect_ocr_row"]), timestamp: z.string(), reviewer: z.string().nullable() }).nullable().optional()
  })).default([]),
  rosterEstimates: z.array(z.object({
    id: z.string(),
    employeeId: z.string(),
    employeeName: z.string(),
    date: z.string(),
    startTime: z.string(),
    finishTime: z.string(),
    breakMinutes: z.number().int().nonnegative().nullable(),
    sourceDocument: z.string().nullable(),
    status: z.enum(["extracted", "confirmed", "manually_entered"]),
    rawFinishTime: z.string().nullable().default(null),
    reviewReason: z.string().nullable().default(null)
  })).optional(),
  rosterAssignments: z.array(z.object({
    id: z.string(),
    employeeId: z.string(),
    employeeName: z.string(),
    date: z.string(),
    type: z.enum(["standby", "office", "stock"]),
    rawValue: z.string(),
    sourceDocument: z.string()
  })).optional(),
  payroll: z.array(z.object({
    employeeId: z.string(),
    employeeName: z.string(),
    ordinaryPaidMinutes: z.number().int(),
    sundayPaidMinutes: z.number().int(),
    otherPaidMinutes: z.number().int(),
    displayedTotalPaidMinutes: z.number().int().nullable()
  })).default([]),
  reviewItems: z.array(z.object({
    id: z.string(),
    employeeName: z.string(),
    filename: z.string(),
    documentPath: z.string().optional(),
    reviewType: z.string().optional(),
    raw: z.string().nullable(),
    proposed: z.string().nullable(),
    reason: z.string()
  })).default([])
});

export type LocalWeek = z.infer<typeof LocalWeekSchema>;

const emptyWeek: LocalWeek = {
  id: "local-week",
  weekStarting: "",
  status: "open",
  documents: [],
  photoAssignments: [],
  employees: [],
  shifts: [],
  rosterEstimates: [],
  rosterAssignments: [],
  payroll: [],
  reviewItems: []
};

export function getAllWeekData(): LocalWeek[] {
  if (!isLocalDataMode()) return getDemoWeeks();
  return getLocalWeeks().map((week) => LocalWeekSchema.parse(week));
}

export function getWeekData(weekId?: string): LocalWeek {
  const weeks = getAllWeekData();
  if (!weekId) return weeks[0] ?? emptyWeek;
  return weeks.find((week) => week.id === weekId) ?? weeks[0] ?? emptyWeek;
}

export function getWeeks() {
  return getAllWeekData()
    .filter((week) => week.weekStarting)
    .map((week) => ({
      id: week.id,
      weekStarting: week.weekStarting,
      status: week.status,
      documents: week.documents.length,
      missingDailySheetDates: missingDailySheetDates(week),
      days: calendarDays(week),
      openReviewItems: week.reviewItems.length,
      discrepancies: 0
    }))
    .sort((a, b) => b.weekStarting.localeCompare(a.weekStarting));
}

export function getShifts(): ShiftInput[] {
  return getWeekData().shifts;
}

export function getPayroll(): PayrollInput[] {
  return getWeekData().payroll;
}
