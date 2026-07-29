import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaddleOcrExtractor } from "@/extraction/providers/paddle-ocr";
import { requireLocalDataMode } from "@/lib/data-mode";
import { localProfilePath } from "@/lib/local-profile";
import { writeWeekById } from "@/lib/local-week-store";
import { rosterCloseTimes } from "@/lib/roster-rules";
import { getWeekData } from "@/lib/week-data";

const ExtractRosterSchema = z.object({ weekId: z.string().min(1), documentId: z.string().min(1) });
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ocrServiceUrl = process.env.OCR_SERVICE_URL ?? "http://127.0.0.1:8001";

function mimeType(path: string) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function POST(request: NextRequest) {
  try {
    requireLocalDataMode();
    const input = ExtractRosterSchema.parse(await request.json());
    const week = getWeekData(input.weekId);
    if (week.id !== input.weekId) throw new Error("Week was not found.");
    const document = week.documents.find((item) => item.id === input.documentId && item.documentType === "roster");
    if (!document) throw new Error("Roster was not found.");
    const filePath = localProfilePath(/* turbopackIgnore: true */ document.path);
    if (!existsSync(filePath)) throw new Error("Local roster image was not found.");
    const health = await fetch(`${ocrServiceUrl}/health`).catch(() => null);
    if (!health?.ok || !(await health.json() as { ocrEngineAvailable?: boolean }).ocrEngineAvailable) throw new Error("Local OCR service is unavailable. Start it with bun run dev:ocr.");
    const extraction = await new PaddleOcrExtractor(ocrServiceUrl).extractRoster({
      filePath,
      mimeType: mimeType(document.path),
      expectedDate: week.weekStarting,
      knownEmployees: week.employees,
      rosterContext: { weekStarting: week.weekStarting, closeTimes: rosterCloseTimes() }
    });
    const retained = (week.rosterEstimates ?? []).filter((estimate) => estimate.sourceDocument !== document.filename || estimate.status !== "extracted");
    const assignments = (week.rosterAssignments ?? []).filter((assignment) => assignment.sourceDocument !== document.filename);
    let createdEstimates = 0;
    let createdAssignments = 0;
    for (const row of extraction.rows) {
      const employee = row.matchedEmployeeId ? week.employees.find((item) => item.id === row.matchedEmployeeId) : undefined;
      if (employee && row.date && row.assignmentType) {
        assignments.push({ id: `roster-assignment-${randomUUID()}`, employeeId: employee.id, employeeName: employee.displayName, date: row.date, type: row.assignmentType, rawValue: row.rawEmployeeName ?? row.assignmentType, sourceDocument: document.filename });
        createdAssignments += 1;
        continue;
      }
      const startTime = row.start?.normalisedValue ?? row.start?.rawValue ?? null;
      const finishTime = row.finish?.normalisedValue ?? row.finish?.rawValue ?? null;
      if (!employee || !row.date || !startTime || !finishTime || !timePattern.test(startTime) || !timePattern.test(finishTime)) continue;
      retained.push({
        id: `roster-ocr-${randomUUID()}`,
        employeeId: employee.id,
        employeeName: employee.displayName,
        date: row.date,
        startTime,
        finishTime,
        breakMinutes: 0,
        sourceDocument: document.filename,
        status: "extracted",
        rawFinishTime: row.finish?.rawValue ?? null,
        reviewReason: row.reviewReasons.join(" ") || "Roster OCR proposal requires review."
      });
      createdEstimates += 1;
    }
    writeWeekById(week.id, { ...week, rosterEstimates: retained, rosterAssignments: assignments });
    return NextResponse.json({ ok: true, createdEstimates, createdAssignments, qualityWarnings: extraction.qualityWarnings });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to extract roster." }, { status: 400 });
  }
}
