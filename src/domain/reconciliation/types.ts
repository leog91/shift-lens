export type ShiftStatus = "extracted" | "confirmed" | "uncertain" | "manually_entered";

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
