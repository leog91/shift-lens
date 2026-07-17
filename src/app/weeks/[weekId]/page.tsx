import { ReconciliationTable } from "@/components/ReconciliationTable";
import { getWeekData } from "@/lib/week-data";
import { WeekCoverage } from "@/components/WeekCoverage";
import { getLocalSettings } from "@/lib/local-settings";

export default async function WeekDashboard({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const week = getWeekData(weekId);
  return (
    <section className="space-y-6">
      <div className="page-heading">
        <p className="eyebrow">Week starting {week.weekStarting}</p>
        <h1>Week dashboard</h1>
        <p>Review actual hours, resolve exceptions, and prepare the weekly record.</p>
      </div>
      <div className="dashboard-actions">
        <a className="dashboard-action" href={`/weeks/${weekId}/hours`}><strong>Confirmed hours</strong><span>Show or share the weekly record</span></a>
        <a className="dashboard-action" href={`/weeks/${weekId}/actual`}><strong>Actual shifts</strong><span>Review paper-sheet entries</span></a>
        <a className="dashboard-action" href={`/weeks/${weekId}/review`}><strong>Review queue ({week.reviewItems.length})</strong><span>Resolve outstanding checks</span></a>
        <a className="dashboard-action" href={`/weeks/${weekId}/comparison`}><strong>Comparison</strong><span>Compare actual and paid time</span></a>
        <a className="dashboard-action" href={`/weeks/${weekId}/documents`}><strong>Upload documents</strong><span>Add weekly source files</span></a>
        <a className="dashboard-action" href={`/weeks/${weekId}/roster`}><strong>Roster context</strong><span>Reference only</span></a>
      </div>
      <WeekCoverage week={week} />
      <ReconciliationTable shifts={week.shifts} payroll={week.payroll} openReviewCount={week.reviewItems.length} priorityEmployeeId={getLocalSettings().priorityEmployeeId} />
    </section>
  );
}
