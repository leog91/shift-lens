import type { LocalWeek } from "./week-data";

export function parseConfirmedPaidHours(value: string): number | null {
  const trimmed = value.trim();
  if (/^\d{1,3}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(":").map(Number);
    if (minutes > 59) return null;
    return hours * 60 + minutes;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(Number(trimmed) * 60);
  }
  return null;
}

export function applyReviewConfirmation(week: LocalWeek, reviewItemId: string, confirmedValue: string): LocalWeek {
  const item = week.reviewItems.find((reviewItem) => reviewItem.id === reviewItemId);
  if (!item) throw new Error("Review item was not found.");

  if (item.reviewType === "break_minutes") {
    if (!/^\d+$/.test(confirmedValue.trim())) throw new Error("Break must be an integer number of minutes.");
    const breakMinutes = Number(confirmedValue.trim());
    if (breakMinutes < 0) throw new Error("Break cannot be negative.");
    return {
      ...week,
      shifts: week.shifts.map((shift) => shift.sourceDocument === item.filename ? { ...shift, breakMinutes, status: "confirmed" as const } : shift),
      reviewItems: week.reviewItems.filter((reviewItem) => reviewItem.id !== reviewItemId)
    };
  }

  if (item.reviewType === "paid_hours") {
    const minutes = parseConfirmedPaidHours(confirmedValue);
    if (minutes == null) throw new Error("Paid hours must be a clear decimal hour value or HH:mm value.");
    return {
      ...week,
      payroll: week.payroll.map((entry) => entry.employeeName === item.employeeName ? {
        ...entry,
        ordinaryPaidMinutes: minutes,
        displayedTotalPaidMinutes: minutes + entry.sundayPaidMinutes + entry.otherPaidMinutes
      } : entry),
      reviewItems: week.reviewItems.filter((reviewItem) => reviewItem.id !== reviewItemId)
    };
  }

  throw new Error("This review item type cannot be confirmed yet.");
}
