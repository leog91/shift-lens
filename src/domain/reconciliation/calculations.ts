import { PayrollInput, ReconciliationStatus, ShiftInput } from "./types";
import { parseClockMinutes, shiftDurationMinutes, workedMinutes } from "./time";

export function splitShiftByDate(date: string, startTime: string, finishTime: string): Record<string, number> {
  const start = parseClockMinutes(startTime);
  const duration = shiftDurationMinutes(startTime, finishTime);
  if (start == null || duration == null) return {};
  const result: Record<string, number> = {};
  let remaining = duration;
  // Use UTC calendar dates so the server's local timezone cannot move a shift to the prior day.
  let cursorDate = new Date(`${date}T00:00:00Z`);
  let cursorMinute = start;
  while (remaining > 0) {
    const minutesToday = Math.min(remaining, 24 * 60 - cursorMinute);
    const key = cursorDate.toISOString().slice(0, 10);
    result[key] = (result[key] ?? 0) + minutesToday;
    remaining -= minutesToday;
    cursorDate = new Date(cursorDate.getTime() + 24 * 60 * 60 * 1000);
    cursorMinute = 0;
  }
  return result;
}

export function sundayMinutes(date: string, startTime: string, finishTime: string): number {
  return Object.entries(splitShiftByDate(date, startTime, finishTime)).reduce((sum, [day, minutes]) => {
    return new Date(`${day}T00:00:00Z`).getUTCDay() === 0 ? sum + minutes : sum;
  }, 0);
}

export function confirmedWorkedMinutes(shift: ShiftInput): number | null {
  if (shift.status !== "confirmed" && shift.status !== "manually_entered") return null;
  if (!shift.startTime || !shift.finishTime || shift.breakMinutes == null) return null;
  return workedMinutes(shift.startTime, shift.finishTime, shift.breakMinutes);
}

export function sumActualByEmployee(shifts: ShiftInput[]) {
  const totals = new Map<string, { employeeName: string; total: number; sunday: number; unresolved: number }>();
  for (const shift of shifts) {
    const current = totals.get(shift.employeeId) ?? { employeeName: shift.employeeName, total: 0, sunday: 0, unresolved: 0 };
    const minutes = confirmedWorkedMinutes(shift);
    if (minutes == null) {
      current.unresolved += 1;
    } else {
      current.total += minutes;
      if (shift.startTime && shift.finishTime) current.sunday += sundayMinutes(shift.date, shift.startTime, shift.finishTime);
    }
    totals.set(shift.employeeId, current);
  }
  return totals;
}

export function totalPaidMinutes(entry: PayrollInput): number {
  return entry.displayedTotalPaidMinutes ?? entry.ordinaryPaidMinutes + entry.sundayPaidMinutes + entry.otherPaidMinutes;
}

export function reconciliationStatus(args: {
  actualTotal: number;
  actualSunday: number;
  payroll: PayrollInput | null;
  unresolvedActualCount: number;
}): ReconciliationStatus {
  if (args.unresolvedActualCount > 0) return "needs_review";
  if (!args.payroll) return "payroll_unavailable";
  const paidTotal = totalPaidMinutes(args.payroll);
  if (args.actualTotal > paidTotal) return "possible_missing_hours";
  if (paidTotal > args.actualTotal) return "possible_extra_paid_hours";
  if (args.actualSunday !== args.payroll.sundayPaidMinutes) return "needs_review";
  return "matches";
}

export function compareActualAndPaid(shifts: ShiftInput[], payrollEntries: PayrollInput[]) {
  const actual = sumActualByEmployee(shifts);
  const payroll = new Map(payrollEntries.map((entry) => [entry.employeeId, entry]));
  const employeeIds = new Set([...actual.keys(), ...payroll.keys()]);
  return [...employeeIds].map((employeeId) => {
    const actualTotals = actual.get(employeeId) ?? { employeeName: payroll.get(employeeId)?.employeeName ?? employeeId, total: 0, sunday: 0, unresolved: 0 };
    const pay = payroll.get(employeeId) ?? null;
    const paid = pay ? totalPaidMinutes(pay) : 0;
    return {
      employeeId,
      employeeName: actualTotals.employeeName,
      actualTotalMinutes: actualTotals.total,
      actualWeekdayMinutes: actualTotals.total - actualTotals.sunday,
      actualSundayMinutes: actualTotals.sunday,
      paidWeekdayMinutes: pay?.ordinaryPaidMinutes ?? 0,
      paidSundayMinutes: pay?.sundayPaidMinutes ?? 0,
      paidTotalMinutes: paid,
      differenceMinutes: actualTotals.total - paid,
      status: reconciliationStatus({ actualTotal: actualTotals.total, actualSunday: actualTotals.sunday, payroll: pay, unresolvedActualCount: actualTotals.unresolved })
    };
  });
}

export function detectDuplicateShifts(shifts: ShiftInput[]): ShiftInput[][] {
  const groups = new Map<string, ShiftInput[]>();
  for (const shift of shifts) {
    const key = [shift.employeeId, shift.date, shift.startTime, shift.finishTime].join("|");
    groups.set(key, [...(groups.get(key) ?? []), shift]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function invalidShiftReason(shift: ShiftInput, maxExpectedMinutes = 16 * 60): string | null {
  if (!shift.startTime || !shift.finishTime) return "Missing start or finish time.";
  const duration = shiftDurationMinutes(shift.startTime, shift.finishTime);
  if (duration == null) return "Invalid time value.";
  if (shift.breakMinutes == null) return "Missing break.";
  if (shift.breakMinutes > duration) return "Break is larger than shift duration.";
  if (duration > maxExpectedMinutes) return "Shift duration is implausibly long.";
  return null;
}
