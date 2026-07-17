import { workedMinutes, type ShiftInput } from "@/domain/reconciliation";

export function confirmedWorkedMinutes(shift: ShiftInput): number | null {
  if ((shift.status !== "confirmed" && shift.status !== "manually_entered") || shift.startTime == null || shift.finishTime == null || shift.breakMinutes == null) return null;
  return workedMinutes(shift.startTime, shift.finishTime, shift.breakMinutes);
}
