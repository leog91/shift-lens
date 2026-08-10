import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyReviewConfirmation } from "@/lib/review-actions";
import { writeWeekById } from "@/lib/local-week-store";
import { getWeekData } from "@/lib/week-data";
import { requireLocalDataMode } from "@/lib/data-mode";

const ConfirmReviewSchema = z.object({
  weekId: z.string().min(1),
  reviewItemId: z.string(),
  confirmedValue: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    requireLocalDataMode();
    const body = ConfirmReviewSchema.parse(await request.json());
    const week = getWeekData(body.weekId);
    if (week.id !== body.weekId) throw new Error("Week was not found.");
    writeWeekById(body.weekId, applyReviewConfirmation(week, body.reviewItemId, body.confirmedValue));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to confirm review item." }, { status: 400 });
  }
}
