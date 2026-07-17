import type { LocalWeek } from "./week-data";
import { isPhotoInboxPath } from "./photo-inbox";

export interface PhotoAssignmentInput {
  path: string;
  weekStarting: string;
  documentType: "daily_sheet" | "roster" | "payslip" | "unknown";
  documentDate: string | null;
  note: string | null;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function applyPhotoAssignment(week: LocalWeek, input: PhotoAssignmentInput): LocalWeek {
  if (!isPhotoInboxPath(input.path)) throw new Error("Photo path is outside the photo inbox.");
  if (!isIsoDate(input.weekStarting)) throw new Error("Week starting date must be YYYY-MM-DD.");
  if (input.documentDate != null && !isIsoDate(input.documentDate)) throw new Error("Document date must be YYYY-MM-DD.");

  const assignment = {
    ...input,
    note: input.note?.trim() ? input.note.trim() : null
  };

  return {
    ...week,
    photoAssignments: [
      ...(week.photoAssignments ?? []).filter((item) => item.path !== input.path),
      assignment
    ]
  };
}

function filenameFromPath(path: string) {
  return path.split("/").pop() ?? path;
}

function weekIdFromStart(weekStarting: string) {
  return `week-${weekStarting}`;
}

function defaultDocumentId(input: PhotoAssignmentInput) {
  return `doc-${input.documentDate ?? input.weekStarting}-${filenameFromPath(input.path).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;
}

export function applyPhotoDocumentAssignment(weeks: LocalWeek[], input: PhotoAssignmentInput): LocalWeek[] {
  if (!isPhotoInboxPath(input.path)) throw new Error("Photo path is outside the photo inbox.");
  if (!isIsoDate(input.weekStarting)) throw new Error("Week starting date must be YYYY-MM-DD.");
  if (input.documentDate != null && !isIsoDate(input.documentDate)) throw new Error("Document date must be YYYY-MM-DD.");

  if (input.documentType === "unknown") {
    const targetWeekIndex = weeks.findIndex((week) => week.weekStarting === input.weekStarting);
    if (targetWeekIndex >= 0) {
      return weeks.map((week, index) => index === targetWeekIndex ? applyPhotoAssignment(week, input) : week);
    }
    return [...weeks, applyPhotoAssignment({
      id: weekIdFromStart(input.weekStarting),
      weekStarting: input.weekStarting,
      status: "needs_review",
      documents: [],
      photoAssignments: [],
      employees: [],
      shifts: [],
      payroll: [],
      reviewItems: []
    }, input)];
  }

  const existingDocument = weeks.flatMap((week) => week.documents).find((document) => document.path === input.path);
  const targetWeekIndex = weeks.findIndex((week) => week.weekStarting === input.weekStarting);
  const targetWeek = targetWeekIndex >= 0 ? weeks[targetWeekIndex] : {
    id: weekIdFromStart(input.weekStarting),
    weekStarting: input.weekStarting,
    status: "needs_review",
    documents: [],
    photoAssignments: [],
    employees: [],
    shifts: [],
    payroll: [],
    reviewItems: []
  } satisfies LocalWeek;

  const updatedDocument = {
    id: existingDocument?.id ?? defaultDocumentId(input),
    documentType: input.documentType,
    documentDate: input.documentDate,
    filename: existingDocument?.filename ?? filenameFromPath(input.path),
    path: input.path,
    qualityWarnings: existingDocument?.qualityWarnings?.length ? existingDocument.qualityWarnings : ["Assigned from photo inbox; rows still need manual extraction and confirmation before totals."]
  };

  const weeksWithoutDocument = weeks.map((week) => ({
    ...week,
    documents: week.documents.filter((document) => document.path !== input.path),
    photoAssignments: (week.photoAssignments ?? []).filter((assignment) => assignment.path !== input.path)
  }));

  if (targetWeekIndex >= 0) {
    return weeksWithoutDocument.map((week, index) => index === targetWeekIndex ? { ...week, documents: [...week.documents, updatedDocument] } : week);
  }

  return [...weeksWithoutDocument, { ...targetWeek, documents: [updatedDocument] }];
}
