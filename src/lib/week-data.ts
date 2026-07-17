import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import type { PayrollInput, ShiftInput } from "@/domain/reconciliation";
import { missingDailySheetDates } from "./week-coverage";
import { localProfilePath } from "./local-profile";
import { isLocalDataMode } from "./data-mode";
import { demoWeeks } from "@/demo-data/weeks";

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

const LocalWeeksSchema = z.array(LocalWeekSchema);

const emptyWeek: LocalWeek = {
  id: "local-week",
  weekStarting: "",
  status: "open",
  documents: [],
  photoAssignments: [],
  employees: [],
  shifts: [],
  payroll: [],
  reviewItems: []
};

function readPrimaryWeek(): LocalWeek {
  const path = localProfilePath("data", "local-week.json");
  if (!existsSync(path)) return emptyWeek;
  return LocalWeekSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

function readExtraWeeks(): LocalWeek[] {
  const path = localProfilePath("data", "local-extra-weeks.json");
  if (!existsSync(path)) return [];
  return LocalWeeksSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function getAllWeekData(): LocalWeek[] {
  if (!isLocalDataMode()) return structuredClone(demoWeeks);
  const primary = readPrimaryWeek();
  const extraWeeks = readExtraWeeks();
  if (!primary.weekStarting) return extraWeeks;
  return [primary, ...extraWeeks.filter((week) => week.id !== primary.id)];
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
