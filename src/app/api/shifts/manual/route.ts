import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { workedMinutes } from "@/domain/reconciliation";
import { writeWeekById } from "@/lib/local-week-store";
import { getWeekData } from "@/lib/week-data";

const CreateManualShiftSchema = z.object({
  weekId: z.string().min(1),
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  finishTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  breakMinutes: z.number().int().nonnegative()
});

export async function POST(request: NextRequest) {
  try {
    const input = CreateManualShiftSchema.parse(await request.json());
    const week = getWeekData(input.weekId);
    if (week.id !== input.weekId) throw new Error("Week was not found.");
    const employee = week.employees.find((item) => item.id === input.employeeId);
    if (!employee) throw new Error("Employee was not found.");
    const weekEnd = new Date(`${week.weekStarting}T00:00:00Z`);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    if (input.date < week.weekStarting || input.date > weekEnd.toISOString().slice(0, 10)) throw new Error("Date must fall within this week.");
    if (workedMinutes(input.startTime, input.finishTime, input.breakMinutes) == null) throw new Error("Break must be shorter than the shift duration.");
    writeWeekById(input.weekId, {
      ...week,
      shifts: [...week.shifts, {
        id: `manual-${randomUUID()}`,
        employeeId: employee.id,
        employeeName: employee.displayName,
        date: input.date,
        startTime: input.startTime,
        finishTime: input.finishTime,
        breakMinutes: input.breakMinutes,
        status: "manually_entered",
        sourceDocument: null
      }]
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to add manual shift." }, { status: 400 });
  }
}
