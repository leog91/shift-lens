import { workedMinutes } from "@/domain/reconciliation";
import type { LocalWeek } from "./week-data";

export function applyShiftConfirmation(week: LocalWeek, shiftId: string): LocalWeek {
  const shift = week.shifts.find((item) => item.id === shiftId);
  if (!shift) throw new Error("Shift was not found.");
  if (!shift.startTime || !shift.finishTime || shift.breakMinutes == null) {
    throw new Error("Start, finish, and break must be present before confirming this row.");
  }
  if (workedMinutes(shift.startTime, shift.finishTime, shift.breakMinutes) == null) {
    throw new Error("This row has invalid times or break minutes.");
  }
  return {
    ...week,
    shifts: week.shifts.map((item) => item.id === shiftId ? { ...item, status: "confirmed" as const } : item)
  };
}
