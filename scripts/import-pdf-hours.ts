/** Bundle for Node (better-sqlite3 is not supported by Bun):
 * bun build scripts/import-pdf-hours.ts --target=node --packages=external --outfile=extracted/import-pdf-hours.mjs
 * SHIFT_LENS_DATA_MODE=local node extracted/import-pdf-hours.mjs <pdf-inbox-directory> --prepare|--apply|--refresh-proposals
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { createProfileBackup } from "../src/lib/profile-backups";
import { getLocalWeeks, writeLocalWeek, closeLocalDatabase } from "../src/lib/local-sqlite-store";
import { localProfileDirectory } from "../src/lib/local-profile";
import { requireLocalDataMode } from "../src/lib/data-mode";
import type { LocalWeek } from "../src/lib/week-data";

requireLocalDataMode();
const directory = resolve(process.argv[2] ?? "");
const mode = process.argv[3];
if (!existsSync(join(directory, "manifest.json")) || !["--prepare", "--apply", "--refresh-proposals"].includes(mode)) throw new Error("Supply a rendered PDF inbox directory and --prepare, --apply or --refresh-proposals.");
const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")) as { sha256: string; pages: { page: number; filename: string }[] };
const cache = join(directory, "ocr");
mkdirSync(cache, { recursive: true });
const employees = [...new Map(getLocalWeeks().flatMap(w => w.employees).map(e => [e.id, e])).values()];
if (mode === "--prepare") {
  console.log("Safety backup:", (await createProfileBackup()).id);
  writeFileSync(join(cache, "employees.json"), JSON.stringify(employees, null, 2));
} else {
  type Value = { rawValue: string | null; normalisedValue?: string | null; minutes: number | null; confidence: number | null; boundingBox: { x: number; y: number; width: number; height: number } | null };
  type Row = { rowIndex: number; rawEmployeeName: string | null; matchedEmployeeId: string; matchedEmployeeName: string; employeeMatchConfidence: number | null; employeeBoundingBox: Value["boundingBox"]; start: Value | null; finish: Value | null; break: Value | null; reviewReasons: string[] };
  type Page = { date: string | null; rawDate?: string | null; dateReview?: { date: string; rawDate: string; reason: string }; imageWidth: number; imageHeight: number; rows: Row[] };
  const report = { importedDocuments: 0, importedRows: 0, preservedExistingRows: 0, pendingPages: [] as number[], missingCheckpoints: [] as number[], pagesNeedingRowReview: [] as number[] };
  for (const entry of manifest.pages) {
    const checkpoint = join(cache, `page-${String(entry.page).padStart(3, "0")}.json`);
    if (!existsSync(checkpoint)) { report.missingCheckpoints.push(entry.page); continue; }
    const page = JSON.parse(readFileSync(checkpoint, "utf8")) as Page;
    if (page.rows.length < 12) report.pagesNeedingRowReview.push(entry.page);
    if (!page.date || !/^\d{4}-\d{2}-\d{2}$/.test(page.date)) { report.pendingPages.push(entry.page); continue; }
    const date = new Date(`${page.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const weekStarting = date.toISOString().slice(0, 10);
    const weeks = getLocalWeeks();
    const week: LocalWeek = weeks.find(w => w.weekStarting === weekStarting) ?? { id: `week-${weekStarting}`, weekStarting, status: "needs_review", documents: [], photoAssignments: [], shifts: [], employees: [], payroll: [], reviewItems: [] };
    const documentId = `pdf-${manifest.sha256.slice(0, 16)}-${entry.page}`;
    const existingDocument = week.documents.find(d => d.id === documentId);
    if (existingDocument && mode !== "--refresh-proposals") continue;
    if (existingDocument && (existingDocument.documentDate !== page.date || existingDocument.documentType !== "daily_sheet")) continue;
    const filename = existingDocument?.filename ?? `${manifest.sha256.slice(0, 12)}-${entry.filename}`;
    const path = relative(localProfileDirectory(), join(directory, entry.filename));
    if (!path.startsWith("photo-inbox/")) throw new Error("PDF must be inside this profile's photo-inbox.");
    if (!existingDocument) {
      week.documents.push({ id: documentId, documentType: "daily_sheet", documentDate: page.date, filename, path, qualityWarnings: [`PDF page ${entry.page}; OCR proposals require human review. Original PDF and page mapping retained in the inbox folder.`, ...(page.dateReview ? [`Date transcription: ${page.dateReview.reason}`] : []), ...(page.rows.length < 12 ? ["Few or no employee labels detected. The sheet may be cropped or obscured; check for missing worked rows manually."] : [])] });
      report.importedDocuments++;
    } else {
      // Only refresh our disposable proposals. Manual corrections, confirmations,
      // dismissals, and rows from other evidence always win over a rerun.
      week.shifts = week.shifts.filter(s => !(s.sourceDocumentId === documentId && s.id.startsWith(`ocr-${documentId}-`) && s.status === "uncertain" && !s.corrections?.length && !s.reviewHistory?.length && !s.dismissal));
      const warning = "Few or no employee labels detected. The sheet may be cropped or obscured; check for missing worked rows manually.";
      if (page.rows.length < 12 && !existingDocument.qualityWarnings.includes(warning)) existingDocument.qualityWarnings.push(warning);
    }
    for (const row of page.rows) {
      const startTime = normaliseTime(row.start?.normalisedValue ?? row.start?.rawValue);
      const finishTime = normaliseTime(row.finish?.normalisedValue ?? row.finish?.rawValue);
      // Retain illegible time ink, but not blank printed template rows or dashes.
      if (!startTime && !finishTime && ![row.start, row.finish].some(v => {
        const raw = v?.rawValue?.trim();
        return raw && !/^(?:[-—–_✓✔v]+|off|no|nil|none|n\/a)$/i.test(raw);
      })) continue;
      if (!row.matchedEmployeeId) continue;
      if (week.shifts.some(s => s.employeeId === row.matchedEmployeeId && s.date === page.date)) { report.preservedExistingRows++; continue; }
      const employee = employees.find(e => e.id === row.matchedEmployeeId) ?? { id: row.matchedEmployeeId, displayName: row.matchedEmployeeName, aliases: [] };
      if (!week.employees.some(e => e.id === employee.id)) week.employees.push(employee);
      week.shifts.push({ id: `ocr-${documentId}-${employee.id}`, employeeId: employee.id, employeeName: employee.displayName, date: page.date,
        startTime, finishTime, breakMinutes: row.break?.minutes ?? null, status: "uncertain", sourceDocument: filename, sourceDocumentId: documentId, sourceRowId: String(row.rowIndex),
        uncertainFields: ["startTime", "finishTime", "breakMinutes", ...(employee.id.startsWith("pdf-employee-") || row.reviewReasons.some(r => r.includes("approximately")) ? ["employeeName"] : [])],
        extraction: { imageWidth: page.imageWidth, imageHeight: page.imageHeight, providerName: "paddle-ocr", extractedAt: new Date().toISOString(), rawEmployeeName: row.rawEmployeeName, rawDate: page.rawDate ?? null,
          rawStartTime: row.start?.rawValue ?? null, rawFinishTime: row.finish?.rawValue ?? null, rawBreak: row.break?.rawValue ?? null,
          confidences: { employee: row.employeeMatchConfidence, start: row.start?.confidence ?? null, finish: row.finish?.confidence ?? null, break: row.break?.confidence ?? null },
          coordinates: { employee: row.employeeBoundingBox, start: row.start?.boundingBox ?? null, finish: row.finish?.boundingBox ?? null, break: row.break?.boundingBox ?? null } }, corrections: [] });
      report.importedRows++;
    }
    writeLocalWeek(week); // A transaction per page; never rewrite all weeks.
  }
  writeFileSync(join(cache, `import-report-${Date.now()}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
closeLocalDatabase();

function normaliseTime(raw: string | null | undefined) {
  const match = raw?.trim().match(/^(\d{1,2})[:.\s]+([0-5]?\d)$/) ?? raw?.trim().match(/^(\d{1,2})([0-5]\d)$/);
  if (!match || Number(match[1]) > 23) return null;
  return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
}
