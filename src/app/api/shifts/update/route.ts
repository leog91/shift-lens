import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeWeekById } from "@/lib/local-week-store";
import { applyShiftUpdate } from "@/lib/shift-update-actions";
import { getWeekData } from "@/lib/week-data";

const UpdateShiftSchema = z.object({
  weekId: z.string(),
  shiftId: z.string(),
  startTime: z.string().nullable(),
  finishTime: z.string().nullable(),
  breakMinutes: z.number().int().nullable()
});

export async function POST(request: NextRequest) {
  try {
    const input = UpdateShiftSchema.parse(await request.json());
    const week = getWeekData(input.weekId);
    const updatedWeek = applyShiftUpdate(week, input);
    writeWeekById(input.weekId, updatedWeek);
    const updatedShiftId = input.shiftId.startsWith("ocr-") ? `manual-${input.shiftId}` : input.shiftId;
    return NextResponse.json({ ok: true, shiftId: updatedShiftId });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update shift." }, { status: 400 });
  }
}
