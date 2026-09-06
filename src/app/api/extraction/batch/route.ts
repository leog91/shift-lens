import { mergeOcrShifts } from "@/lib/merge-ocr-shifts";
import { existsSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PaddleOcrExtractor } from "@/extraction/providers/paddle-ocr";
import { writeWeekById } from "@/lib/local-week-store";
import { getWeekData } from "@/lib/week-data";
import { localProfilePath } from "@/lib/local-profile";
import { requireLocalDataMode } from "@/lib/data-mode";

const BatchSchema = z.object({ weekId: z.string().min(1), documentId: z.string().min(1).optional() });
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ocrServiceUrl = process.env.OCR_SERVICE_URL ?? "http://127.0.0.1:8001";

function mimeType(path: string) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function normaliseTime(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (timePattern.test(trimmed)) return trimmed;
  // Handwritten times may use dots, extra punctuation, or omit separators entirely.
  const lenient = trimmed.match(/^(\d{1,2})[:.\s]+([0-5]?\d)$/);
  if (lenient) {
    const hours = Number(lenient[1]);
    const minutes = Number(lenient[2]);
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  // Compact 3-4 digit values such as "930" or "1000".
  const noSeparator = trimmed.match(/^(\d{1,2})([0-5]\d)$/);
  if (noSeparator) {
    const hours = Number(noSeparator[1]);
    const minutes = Number(noSeparator[2]);
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    requireLocalDataMode();
    const { weekId, documentId } = BatchSchema.parse(await request.json());
    const week = getWeekData(weekId);
    if (week.id !== weekId) throw new Error("Week was not found.");
    const knownEmployees = week.employees.length ? week.employees : getWeekData().employees;

    let healthResponse: Response;
    try {
      healthResponse = await fetch(`${ocrServiceUrl}/health`);
    } catch {
      throw new Error(`Local OCR service is unavailable at ${ocrServiceUrl}. Start it with bun run dev:ocr.`);
    }
    const health = await healthResponse.json() as { ocrEngineAvailable?: boolean };
    if (!health.ocrEngineAvailable) {
      throw new Error("Local OCR service is running, but its PaddleOCR engine is not configured. Batch extraction cannot create rows until the engine is wired.");
    }

    const extractor = new PaddleOcrExtractor(ocrServiceUrl);
    const dailyDocuments = week.documents.filter((document) => document.documentType === "daily_sheet" && (documentId == null || document.id === documentId));
    if (documentId != null && dailyDocuments.length === 0) throw new Error("Daily sheet was not found.");
    const successful: Array<{ document: (typeof dailyDocuments)[number]; proposals: typeof week.shifts }> = [];
    const results: Array<{ filename: string; createdRows: number; error?: string }> = [];

    for (const document of dailyDocuments) {
      if (!document.documentDate) { results.push({ filename: document.filename, createdRows: 0, error: "Assign and verify the paper date before extraction." }); continue; }
      const filePath = localProfilePath(/* turbopackIgnore: true */ document.path);
      if (!existsSync(filePath)) {
        results.push({ filename: document.filename, createdRows: 0, error: "Local photo file was not found." });
        continue;
      }

      try {
        const extraction = await extractor.extractDailySheet({
          filePath,
          mimeType: mimeType(document.path),
          expectedDate: document.documentDate ?? undefined,
          knownEmployees,
          expectedColumnNames: ["Name", "Start", "Finish", "Break"]
        });
        const proposals: typeof week.shifts = [];
        let createdRows = 0;
        for (const row of extraction.rows) {
          const candidate = row.matchedEmployeeId ? knownEmployees.find((employee) => employee.id === row.matchedEmployeeId) : knownEmployees.find((employee) => {
            const name = row.rawEmployeeName?.trim().toLowerCase();
            return name === employee.displayName.toLowerCase() || employee.aliases.some((alias) => alias.toLowerCase() === name);
          });
          if (!candidate) continue;
          const sourceRowId = String(row.rowIndex);
          if (proposals.some((shift) => shift.employeeId === candidate.id)) continue;
          const startTime = normaliseTime(row.start?.normalisedValue ?? row.start?.rawValue);
          const finishTime = normaliseTime(row.finish?.normalisedValue ?? row.finish?.rawValue);
          // Printed blank template rows still have employee names. Do not add them.
          if (startTime == null && finishTime == null) continue;
          proposals.push({
            id: `ocr-${document.id}-${candidate.id}`,
            employeeId: candidate.id,
            employeeName: candidate.displayName,
            date: document.documentDate ?? week.weekStarting,
            startTime,
            finishTime,
            breakMinutes: row.break?.minutes ?? null,
            status: "uncertain",
            sourceDocument: document.filename,
            sourceDocumentId: document.id,
            sourceRowId,
            uncertainFields: [
              ...(startTime == null || (row.start?.confidence == null || row.start.confidence < 0.85) ? ["startTime"] : []),
              ...(finishTime == null || (row.finish?.confidence == null || row.finish.confidence < 0.85) ? ["finishTime"] : []),
              ...(row.break?.minutes == null || (row.break?.confidence == null || row.break.confidence < 0.85) ? ["breakMinutes"] : [])
            ],
            extraction: {
              imageWidth: extraction.imageWidth ?? null,
              imageHeight: extraction.imageHeight ?? null,
              providerName: extraction.providerName,
              extractedAt: new Date().toISOString(),
              rawEmployeeName: row.rawEmployeeName,
              rawDate: row.date ?? extraction.date,
              rawStartTime: row.start?.rawValue ?? null,
              rawFinishTime: row.finish?.rawValue ?? null,
              rawBreak: row.break?.rawValue ?? null,
              confidences: { employee: row.employeeMatchConfidence ?? null, start: row.start?.confidence ?? null, finish: row.finish?.confidence ?? null, break: row.break?.confidence ?? null },
              coordinates: { employee: row.employeeBoundingBox ?? null, start: row.start?.boundingBox ?? null, finish: row.finish?.boundingBox ?? null, break: row.break?.boundingBox ?? null }
            },
            corrections: [],
            dismissal: null
          });
          createdRows += 1;
        }
        successful.push({ document, proposals });
        results.push({ filename: document.filename, createdRows });
      } catch (error) {
        results.push({ filename: document.filename, createdRows: 0, error: error instanceof Error ? error.message : "OCR extraction failed." });
      }
    }

    // Re-read after the slow OCR calls. Edits made while extraction runs win.
    const latest = getWeekData(weekId);
    if (latest.id !== weekId) throw new Error("Week was not found.");
    let nextShifts = latest.shifts;
    for (const { document, proposals } of successful) {
      const liveDocument = latest.documents.find((item) => item.id === document.id && item.documentType === "daily_sheet");
      if (!liveDocument || liveDocument.documentDate !== document.documentDate || liveDocument.path !== document.path) continue;
      const previousIds = new Set(nextShifts.map((shift) => shift.id));
      nextShifts = mergeOcrShifts(nextShifts, week.shifts, liveDocument, proposals);
      const result = results.find((item) => item.filename === document.filename);
      if (result) result.createdRows = nextShifts.filter((shift) => !previousIds.has(shift.id)).length;
    }
    writeWeekById(weekId, { ...latest, shifts: nextShifts });
    return NextResponse.json({ ok: true, processedDocuments: dailyDocuments.length, results, shifts: nextShifts });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to run batch extraction." }, { status: 400 });
  }
}
