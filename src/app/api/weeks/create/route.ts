import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAllWeekData, type LocalWeek } from "@/lib/week-data";
import { writeLocalWeek } from "@/lib/local-week-store";
import { requireLocalDataMode } from "@/lib/data-mode";

const CreateWeekSchema = z.object({ weekStarting: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(request: NextRequest) {
  try {
    requireLocalDataMode();
    const { weekStarting } = CreateWeekSchema.parse(await request.json());
    const start = new Date(`${weekStarting}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || start.getUTCDay() !== 1) throw new Error("Week starting date must be a Monday.");
    if (getAllWeekData().some((week) => week.weekStarting === weekStarting)) throw new Error("A week with this start date already exists.");
    const week: LocalWeek = {
      id: `week-${weekStarting}`,
      weekStarting,
      status: "open",
      documents: [],
      photoAssignments: [],
      employees: [],
      shifts: [],
      payroll: [],
      reviewItems: []
    };
    writeLocalWeek(week);
    return NextResponse.json({ ok: true, weekId: week.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create week." }, { status: 400 });
  }
}
