import { z } from "zod";
import { createHash } from "node:crypto";
import { confirmedWorkedMinutes, totalPaidMinutes } from "@/domain/reconciliation";
import type { LocalWeek } from "../week-data";

const id = z.string().min(1).max(200);
const date = z.iso.date();
const minutes = z.number().int().nonnegative().max(100_000);
export const PublishedWeekSchema = z.strictObject({
  id,
  weekStarting: date,
  shifts: z.array(z.strictObject({
    id, employeeId: id, employeeName: z.string().min(1).max(200), date,
    workedMinutes: minutes.max(1440)
  })).max(10_000),
  payroll: z.array(z.strictObject({
    employeeId: id, employeeName: z.string().min(1).max(200),
    ordinaryPaidMinutes: minutes, sundayPaidMinutes: minutes,
    otherPaidMinutes: minutes, totalPaidMinutes: minutes.max(300_000)
  })).max(10_000)
});
export const PublishedSnapshotSchema = z.strictObject({
  version: z.literal(1), weeks: z.array(PublishedWeekSchema).max(1000)
}).superRefine((snapshot, ctx) => {
  if (new Set(snapshot.weeks.map(week => week.id)).size !== snapshot.weeks.length) {
    ctx.addIssue({ code: "custom", message: "Duplicate week IDs." });
  }
  for (const week of snapshot.weeks) {
    if (new Set(week.shifts.map(shift => shift.id)).size !== week.shifts.length ||
      new Set(week.payroll.map(entry => entry.employeeId)).size !== week.payroll.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate records." });
    }
  }
});
export type PublishedSnapshot = z.infer<typeof PublishedSnapshotSchema>;
export const SyncEnvelopeSchema = z.strictObject({
  sourceId: z.uuid(), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  snapshot: PublishedSnapshotSchema
});

function publishedId(kind: string, value: string) {
  // Existing OCR shift IDs embed document IDs derived from filenames. Never
  // transmit those identifiers verbatim, even when the row itself is verified.
  return createHash("sha256").update(`${kind}\n${value}`).digest("hex");
}

// Explicit allowlist. Never spread local objects across this privacy boundary.
export function projectVerifiedData(weeks: LocalWeek[]): PublishedSnapshot {
  return PublishedSnapshotSchema.parse({
    version: 1,
    weeks: [...weeks].filter(week => date.safeParse(week.weekStarting).success)
      .sort((a, b) => a.id.localeCompare(b.id)).map(week => ({
        id: publishedId("week", week.id), weekStarting: week.weekStarting,
        shifts: [...week.shifts].sort((a, b) => a.id.localeCompare(b.id)).flatMap(shift => {
          if (!shift.employeeId || !shift.id || shift.uncertainFields?.length || !date.safeParse(shift.date).success) return [];
          // An outstanding review for this person also makes a confirmed flag insufficient.
          if (week.reviewItems.some(item => item.reviewType !== "paid_hours" && item.employeeName === shift.employeeName)) return [];
          const worked = confirmedWorkedMinutes(shift);
          if (worked == null || !Number.isInteger(worked)) return [];
          const candidate = PublishedWeekSchema.shape.shifts.element.safeParse({
            id: publishedId("shift", shift.id), employeeId: publishedId("employee", shift.employeeId), employeeName: shift.employeeName,
            date: shift.date, workedMinutes: worked
          });
          return candidate.success ? [candidate.data] : [];
        }),
        payroll: [...week.payroll].sort((a, b) => a.employeeId.localeCompare(b.employeeId)).flatMap(entry => {
          if (!entry.employeeId || entry.verified !== true || week.reviewItems.some(item => item.reviewType === "paid_hours" && item.employeeName === entry.employeeName)) return [];
          const candidate = PublishedWeekSchema.shape.payroll.element.safeParse({ employeeId: publishedId("employee", entry.employeeId), employeeName: entry.employeeName,
            ordinaryPaidMinutes: entry.ordinaryPaidMinutes, sundayPaidMinutes: entry.sundayPaidMinutes,
            otherPaidMinutes: entry.otherPaidMinutes, totalPaidMinutes: totalPaidMinutes(entry) });
          return candidate.success ? [candidate.data] : [];
        })
      }))
  });
}
