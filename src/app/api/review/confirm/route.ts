import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyReviewConfirmation } from "@/lib/review-actions";
import { readLocalWeek, writeLocalWeek } from "@/lib/local-week-store";

const ConfirmReviewSchema = z.object({
  reviewItemId: z.string(),
  confirmedValue: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    const body = ConfirmReviewSchema.parse(await request.json());
    const week = readLocalWeek();
    const updated = applyReviewConfirmation(week, body.reviewItemId, body.confirmedValue);
    writeLocalWeek(updated);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to confirm review item." }, { status: 400 });
  }
}
