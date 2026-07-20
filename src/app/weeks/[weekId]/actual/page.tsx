import { getWeekData } from "@/lib/week-data";
import { ActualWeekClient } from "@/components/ActualWeekClient";
import { WeekCoverage } from "@/components/WeekCoverage";
import { BatchExtractionButton } from "@/components/BatchExtractionButton";
import { isLocalDataMode } from "@/lib/data-mode";
import { ManualShiftForm } from "@/components/ManualShiftForm";

export default async function ActualPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const week = getWeekData(weekId);
  const { shifts, documents } = week;
  const employees = week.employees.length ? week.employees : getWeekData().employees;
  const dailyDocumentStates = documents.filter((document) => document.documentType === "daily_sheet").map((document) => ({
    document,
    shifts: shifts.filter((shift) => shift.sourceDocument === document.filename)
  }));
  const unprocessedDocuments = dailyDocumentStates.filter(({ shifts: documentShifts }) => documentShifts.length === 0).length;
  const reviewOnlyDocuments = dailyDocumentStates.filter(({ shifts: documentShifts }) => documentShifts.length > 0 && documentShifts.every((shift) => shift.id.startsWith("ocr-") && shift.status === "uncertain")).length;
  const readOnly = !isLocalDataMode();
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Actual shifts</h1>
        <p className="text-stone-600">Compare each paper photo with what the app currently understands. Review rows are excluded from confirmed totals.</p>
      </div>
      <WeekCoverage week={week} />
      {readOnly ? <div className="demo-notice" role="note"><strong>Demo account</strong><span>Document processing and edits are disabled. These fictional records show how local processing looks.</span></div> : <BatchExtractionButton dailySheetCount={dailyDocumentStates.length} reviewOnlyDocuments={reviewOnlyDocuments} unprocessedDocuments={unprocessedDocuments} weekId={weekId} />}
      {!readOnly ? <ManualShiftForm employees={employees} weekId={week.id} weekStarting={week.weekStarting} /> : null}
      <ActualWeekClient readOnly={readOnly} weekId={week.id} documents={documents} shifts={shifts} employees={employees} />
    </section>
  );
}
