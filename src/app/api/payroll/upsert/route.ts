import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeWeekById } from "@/lib/local-week-store";
import { getWeekData } from "@/lib/week-data";

const minutes = z.number().int().nonnegative().max(100_000);
const UpsertPayrollSchema = z.object({
  weekId: z.string().min(1),
  employeeId: z.string().min(1),
  ordinaryPaidMinutes: minutes,
  sundayPaidMinutes: minutes,
  otherPaidMinutes: minutes,
  displayedTotalPaidMinutes: minutes.nullable()
});

export async function POST(request: NextRequest) {
  try {
    const input = UpsertPayrollSchema.parse(await request.json());
    const week = getWeekData(input.weekId);
    if (week.id !== input.weekId) throw new Error("Week was not found.");
    const employee = week.employees.find((item) => item.id === input.employeeId);
    if (!employee) throw new Error("Employee was not found.");
    const entry = { ...input, employeeName: employee.displayName };
    writeWeekById(input.weekId, {
      ...week,
      payroll: [...week.payroll.filter((item) => item.employeeId !== employee.id), entry]
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to save payroll entry." }, { status: 400 });
  }
}
