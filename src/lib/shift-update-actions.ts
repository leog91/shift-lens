import type { LocalWeek } from "./week-data";

export function applyShiftUpdate(week: LocalWeek, input: {
  shiftId: string;
  startTime: string | null;
  finishTime: string | null;
  breakMinutes: number | null;
  correctionReason?: string;
}): LocalWeek {
  const shift = week.shifts.find((item) => item.id === input.shiftId);
  if (!shift) throw new Error("Shift was not found.");
  if (shift.status === "dismissed") throw new Error("Restore this row before editing it.");
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (input.startTime != null && !timePattern.test(input.startTime)) throw new Error("Start time must use HH:mm.");
  if (input.finishTime != null && !timePattern.test(input.finishTime)) throw new Error("Finish time must use HH:mm.");
  if (input.breakMinutes != null && !Number.isInteger(input.breakMinutes)) throw new Error("Break must be an integer number of minutes.");
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
      status: "uncertain" as const,
      dismissal: null,
      uncertainFields: [...(input.startTime == null ? ["startTime"] : []), ...(input.finishTime == null ? ["finishTime"] : []), ...(input.breakMinutes == null ? ["breakMinutes"] : [])],
      corrections: [...(item.corrections ?? []), {
        previousValue: { startTime: item.startTime, finishTime: item.finishTime, breakMinutes: item.breakMinutes },
        newValue: { startTime: input.startTime, finishTime: input.finishTime, breakMinutes: input.breakMinutes },
        timestamp: new Date().toISOString(),
        reason: input.correctionReason?.trim() || "Manual correction",
        reviewer: null
      }]
    } : item)
  };
}
