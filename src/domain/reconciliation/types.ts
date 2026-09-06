export type ShiftStatus = "extracted" | "confirmed" | "uncertain" | "manually_entered" | "dismissed";

export type DismissalReason = "not_worked" | "incorrect_ocr_row";

export interface ShiftCorrection {
  previousValue: { startTime: string | null; finishTime: string | null; breakMinutes: number | null };
  newValue: { startTime: string | null; finishTime: string | null; breakMinutes: number | null };
  timestamp: string;
  reason: string;
  reviewer: string | null;
}

export interface ShiftExtraction {
  imageWidth?: number | null;
  imageHeight?: number | null;
  providerName: string;
  extractedAt: string;
  rawEmployeeName: string | null;
  rawDate: string | null;
  rawStartTime: string | null;
  rawFinishTime: string | null;
  rawBreak: string | null;
  confidences: { employee: number | null; start: number | null; finish: number | null; break: number | null };
  coordinates: { employee: { x: number; y: number; width: number; height: number } | null; start: { x: number; y: number; width: number; height: number } | null; finish: { x: number; y: number; width: number; height: number } | null; break: { x: number; y: number; width: number; height: number } | null };
}

export interface ShiftInput {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string | null;
  finishTime: string | null;
  breakMinutes: number | null;
  status: ShiftStatus;
  sourceDocument?: string | null;
  sourceDocumentId?: string | null;
  sourceRowId?: string | null;
  uncertainFields?: string[];
  extraction?: ShiftExtraction | null;
  corrections?: ShiftCorrection[];
  reviewHistory?: Array<{ action: "dismiss" | "restore"; reason: DismissalReason; timestamp: string; reviewer: string | null }>;
  dismissal?: { reason: DismissalReason; timestamp: string; reviewer: string | null } | null;
}

export interface PayrollInput {
  employeeId: string;
  employeeName: string;
  ordinaryPaidMinutes: number;
  sundayPaidMinutes: number;
  otherPaidMinutes: number;
  displayedTotalPaidMinutes: number | null;
}

export type ReconciliationStatus =
  | "matches"
  | "possible_missing_hours"
  | "possible_extra_paid_hours"
  | "payroll_unavailable"
  | "needs_review"
  | "incomplete";
