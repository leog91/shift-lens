import { getWeekData } from "@/lib/week-data";
import { ActualWeekClient } from "@/components/ActualWeekClient";
import { WeekCoverage } from "@/components/WeekCoverage";
import { isLocalDataMode } from "@/lib/data-mode";
import { ManualShiftForm } from "@/components/ManualShiftForm";

export default async function ActualPage({ params, searchParams }: { params: Promise<{ weekId: string }>; searchParams: Promise<{ date?: string }> }) {
  const { weekId } = await params;
  const week = getWeekData(weekId);
  const { shifts, documents } = week;
  const employees = week.employees.length ? week.employees : getWeekData().employees;
  const readOnly = !isLocalDataMode();
  const requestedDate = (await searchParams).date;
  const initialDate = documents.some(d => d.documentType === "daily_sheet" && d.documentDate === requestedDate) ? requestedDate : undefined;
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Actual shifts</h1>
        <p className="text-stone-600">Compare each paper photo with what the app currently understands. Review rows are excluded from confirmed totals.</p>
      </div>
      <WeekCoverage week={week} />
      {readOnly ? <div className="demo-notice" role="note"><strong>Demo account</strong><span>Document processing and edits are disabled. These fictional records show how local processing looks.</span></div> : null}
      {!readOnly ? <ManualShiftForm employees={employees} weekId={week.id} weekStarting={week.weekStarting} /> : null}
      <ActualWeekClient key={`${week.id}-${initialDate ?? "all"}`} initialDate={initialDate} readOnly={readOnly} weekId={week.id} documents={documents} shifts={shifts} employees={employees} />
    </section>
  );
}
