import { z } from "zod";
import type { PayrollInput, ShiftInput } from "@/domain/reconciliation";
import { missingDailySheetDates } from "./week-coverage";
import { isLocalDataMode } from "./data-mode";
import { getDemoWeeks } from "@/demo/database";
import { getLocalWeeks } from "./local-sqlite-store";

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
    status: z.enum(["extracted", "confirmed", "uncertain", "manually_entered"]),
    sourceDocument: z.string().nullable().optional()
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
