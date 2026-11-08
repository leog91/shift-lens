import { workedMinutes, type ShiftInput } from "@/domain/reconciliation";

export function confirmedWorkedMinutes(shift: ShiftInput): number | null {
  if ((shift.status !== "confirmed" && shift.status !== "manually_entered") || shift.startTime == null || shift.finishTime == null || shift.breakMinutes == null) return null;
  return workedMinutes(shift.startTime, shift.finishTime, shift.breakMinutes);
}

export function employeeHoursSummary(shifts: ShiftInput[], date?: string) {
  const workedDates = new Map<string, Set<string>>();
  const people = new Map<string, { employeeId: string; employeeName: string; minutes: number | null; weekMinutes: number | null; reviewRows: number }>();
  for (const shift of shifts) {
    if (shift.status === "dismissed") continue;
    const person = people.get(shift.employeeId) ?? { employeeId: shift.employeeId, employeeName: shift.employeeName, minutes: null, weekMinutes: null, reviewRows: 0 };
    const minutes = confirmedWorkedMinutes(shift);
    if (minutes != null) person.weekMinutes = (person.weekMinutes ?? 0) + minutes;
    if (!date || shift.date === date) {
      if (minutes == null) person.reviewRows++;
      else {
        person.minutes = (person.minutes ?? 0) + minutes;
        const dates = workedDates.get(shift.employeeId) ?? new Set<string>();
        dates.add(shift.date);
        workedDates.set(shift.employeeId, dates);
      }
    }
    people.set(shift.employeeId, person);
  }
  return [...people.values()]
    .filter(person => person.minutes != null || person.reviewRows > 0)
    .map(person => ({ ...person, daysWorked: workedDates.get(person.employeeId)?.size ?? 0 }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.employeeId.localeCompare(b.employeeId));
}

export function employeeHoursRanking(shifts: ShiftInput[], date?: string) {
  const people = employeeHoursSummary(shifts, date).sort((a, b) => {
    if (a.minutes == null) return b.minutes == null ? a.employeeName.localeCompare(b.employeeName) : 1;
    if (b.minutes == null) return -1;
    return b.minutes - a.minutes || a.employeeName.localeCompare(b.employeeName) || a.employeeId.localeCompare(b.employeeId);
  });
  let rank: number | null = null;
  return people.map((person, index) => {
    if (person.minutes == null) rank = null;
    else if (index === 0 || person.minutes !== people[index - 1].minutes) rank = index + 1;
    return { ...person, rank };
  });
}
