import type { LocalWeek } from "./week-data";

export function applyShiftUpdate(week: LocalWeek, input: {
  shiftId: string;
  startTime: string | null;
  finishTime: string | null;
  breakMinutes: number | null;
}): LocalWeek {
  const shift = week.shifts.find((item) => item.id === input.shiftId);
  if (!shift) throw new Error("Shift was not found.");
  if (input.startTime && !/^\d{2}:\d{2}$/.test(input.startTime)) throw new Error("Start time must use HH:mm.");
  if (input.finishTime && !/^\d{2}:\d{2}$/.test(input.finishTime)) throw new Error("Finish time must use HH:mm.");
  if (input.breakMinutes != null && input.breakMinutes < 0) throw new Error("Break cannot be negative.");

  return {
    ...week,
    shifts: week.shifts.map((item) => item.id === input.shiftId ? {
      ...item,
      // A user-edited OCR row is no longer disposable OCR output.
      id: item.id.startsWith("ocr-") ? `manual-${item.id}` : item.id,
      startTime: input.startTime,
      finishTime: input.finishTime,
      breakMinutes: input.breakMinutes,
      status: "uncertain" as const
    } : item)
  };
}
