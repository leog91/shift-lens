import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { workedMinutes } from "@/domain/reconciliation";
import { requireLocalDataMode } from "@/lib/data-mode";
import { writeWeekById } from "@/lib/local-week-store";
import { getWeekData } from "@/lib/week-data";

const ConfirmRosterEstimateSchema = z.object({ weekId: z.string().min(1), estimateId: z.string().min(1), breakMinutes: z.number().int().nonnegative() });

export async function POST(request: NextRequest) {
  try {
    requireLocalDataMode();
    const input = ConfirmRosterEstimateSchema.parse(await request.json());
    const week = getWeekData(input.weekId);
    const estimate = (week.rosterEstimates ?? []).find((item) => item.id === input.estimateId);
    if (!estimate) throw new Error("Roster estimate was not found.");
    if (workedMinutes(estimate.startTime, estimate.finishTime, input.breakMinutes) == null) throw new Error("Break must be shorter than the shift duration.");
    writeWeekById(week.id, { ...week, rosterEstimates: (week.rosterEstimates ?? []).map((item) => item.id === input.estimateId ? { ...item, breakMinutes: input.breakMinutes, status: "confirmed", reviewReason: null } : item) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to confirm roster estimate." }, { status: 400 });
  }
}
