import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeWeekById } from "@/lib/local-week-store";
import { getWeekData } from "@/lib/week-data";

const CreateShiftSchema = z.object({
  weekId: z.string().min(1),
  documentId: z.string().min(1),
  employeeId: z.string().min(1),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable(),
  breakMinutes: z.number().int().nonnegative().nullable()
});

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: NextRequest) {
  try {
    const input = CreateShiftSchema.parse(await request.json());
    const week = getWeekData(input.weekId);
    if (week.id !== input.weekId) throw new Error("Week was not found.");
    const document = week.documents.find((item) => item.id === input.documentId && item.documentType === "daily_sheet");
    if (!document) throw new Error("Daily sheet was not found.");
    const employee = week.employees.find((item) => item.id === input.employeeId);
    if (!employee) throw new Error("Employee was not found.");
    if (input.startTime && !timePattern.test(input.startTime)) throw new Error("Start time must use HH:mm.");
    if (input.finishTime && !timePattern.test(input.finishTime)) throw new Error("Finish time must use HH:mm.");
    if (week.shifts.some((shift) => shift.sourceDocument === document.filename && shift.employeeId === employee.id)) {
      throw new Error("This employee already has a row on this page.");
    }

    writeWeekById(input.weekId, {
      ...week,
      shifts: [...week.shifts, {
        id: `manual-${document.id}-${employee.id}`,
        employeeId: employee.id,
        employeeName: employee.displayName,
        date: document.documentDate ?? week.weekStarting,
        startTime: input.startTime,
        finishTime: input.finishTime,
        breakMinutes: input.breakMinutes,
        status: "uncertain",
        sourceDocument: document.filename
      }]
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to add row." }, { status: 400 });
  }
}
