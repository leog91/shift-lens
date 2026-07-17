import { getWeekData } from "@/lib/week-data";
import { ActualWeekClient } from "@/components/ActualWeekClient";
import { WeekCoverage } from "@/components/WeekCoverage";
import { BatchExtractionButton } from "@/components/BatchExtractionButton";

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
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Actual shifts</h1>
        <p className="text-stone-600">Compare each paper photo with what the app currently understands. Review rows are excluded from confirmed totals.</p>
      </div>
      <WeekCoverage week={week} />
      <BatchExtractionButton dailySheetCount={dailyDocumentStates.length} reviewOnlyDocuments={reviewOnlyDocuments} unprocessedDocuments={unprocessedDocuments} weekId={weekId} />
      <ActualWeekClient weekId={week.id} documents={documents} shifts={shifts} employees={employees} />
    </section>
  );
}
