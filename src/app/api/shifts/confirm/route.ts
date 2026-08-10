import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeWeekById } from "@/lib/local-week-store";
import { applyShiftConfirmation } from "@/lib/shift-actions";
import { getWeekData } from "@/lib/week-data";

const ConfirmShiftSchema = z.object({ weekId: z.string(), shiftId: z.string() });

export async function POST(request: NextRequest) {
  try {
    const { weekId, shiftId } = ConfirmShiftSchema.parse(await request.json());
    const week = getWeekData(weekId);
    if (week.id !== weekId) throw new Error("Week was not found.");
    writeWeekById(weekId, applyShiftConfirmation(week, shiftId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to confirm shift." }, { status: 400 });
  }
}
