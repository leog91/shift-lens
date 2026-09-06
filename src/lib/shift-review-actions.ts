import type { DismissalReason } from "@/domain/reconciliation";
import type { LocalWeek } from "./week-data";

export function applyShiftDismissal(week: LocalWeek, shiftId: string, reason: DismissalReason): LocalWeek {
  const shift = week.shifts.find((item) => item.id === shiftId);
  if (!shift) throw new Error("Shift was not found.");
  if (shift.status === "confirmed" || shift.status === "manually_entered") throw new Error("Confirmed rows cannot be dismissed.");
  if (shift.status === "dismissed") return week;
  const event = { action: "dismiss" as const, reason, timestamp: new Date().toISOString(), reviewer: null };
  return {
    ...week,
    shifts: week.shifts.map((item) => item.id === shiftId ? {
      ...item,
      status: "dismissed" as const,
      dismissal: { reason, timestamp: event.timestamp, reviewer: null },
      reviewHistory: [...(item.reviewHistory ?? []), event]
    } : item)
  };
}

export function applyShiftRestore(week: LocalWeek, shiftId: string): LocalWeek {
  const shift = week.shifts.find((item) => item.id === shiftId);
  if (!shift) throw new Error("Shift was not found.");
  if (shift.status !== "dismissed") throw new Error("Shift is not dismissed.");
  return { ...week, shifts: week.shifts.map((item) => item.id === shiftId ? {
    ...item, status: "uncertain" as const, dismissal: null,
    reviewHistory: [...(item.reviewHistory ?? []),
      ...(!item.reviewHistory?.length && item.dismissal ? [{ action: "dismiss" as const, ...item.dismissal }] : []),
      ...(item.dismissal ? [{ action: "restore" as const, reason: item.dismissal.reason, timestamp: new Date().toISOString(), reviewer: null }] : [])]
  } : item) };

}
