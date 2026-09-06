import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWeekData } from "@/lib/week-data";
import { writeWeekById } from "@/lib/local-week-store";
import { applyShiftRestore } from "@/lib/shift-review-actions";

const Schema = z.object({ weekId: z.string().min(1), shiftId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const input = Schema.parse(await request.json());
    const week = getWeekData(input.weekId);
    if (week.id !== input.weekId) throw new Error("Week was not found.");
    const updated = applyShiftRestore(week, input.shiftId);
    writeWeekById(input.weekId, updated);
    return NextResponse.json({ ok: true, shift: updated.shifts.find((item) => item.id === input.shiftId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to restore shift." }, { status: 400 });
  }
}
