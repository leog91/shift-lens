import { formatDuration } from "@/domain/reconciliation";
import { getAllWeekData } from "@/lib/week-data";
import { hoursHistory } from "@/lib/hours-history";
import { HoursHistory } from "@/components/HoursHistory";
import { HoursExplorer } from "@/components/HoursExplorer";
import { missingDailySheetDates } from "@/lib/week-coverage";

export default async function EmployeeHoursPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  const weeks = getAllWeekData();
  const employee = weeks.flatMap(week => week.employees).find(person => person.id === employeeId);
  const periods = { week: hoursHistory(weeks, "week", employeeId), month: hoursHistory(weeks, "month", employeeId), year: hoursHistory(weeks, "year", employeeId) };
  const totalMinutes = periods.week.reduce((sum, week) => sum + week.minutes, 0);
  const name = employee?.displayName ?? "Employee";

  return <section className="space-y-6">
    <div className="page-heading"><p className="eyebrow">Employee hours</p><h1>{name}</h1><p>Confirmed actual hours only. Uncertain and incomplete shifts are not included.</p></div>
    <div className="hours-stat-grid">
      <div className="hours-stat"><span>Confirmed total</span><strong>{formatDuration(totalMinutes)}</strong></div>
      <div className="hours-stat"><span>Weeks with hours</span><strong>{periods.week.length}</strong></div>
      <div className="hours-stat"><span>Average week</span><strong>{periods.week.length ? formatDuration(Math.round(totalMinutes / periods.week.length)) : "-"}</strong></div>
      <div className="hours-stat"><span>Aliases</span><strong>{employee?.aliases.length ?? 0}</strong></div>
    </div>
    {periods.week.length === 0 ? <div className="empty-state">No complete confirmed shifts are available for this employee yet.</div> : <HoursHistory periods={periods} name={name} headingId="employee-history-heading" />}
    <HoursExplorer key={employeeId} shifts={weeks.flatMap(week => week.shifts).filter(shift => shift.employeeId === employeeId)} weekStarts={weeks.map(week => week.weekStarting)} missingDates={weeks.flatMap(missingDailySheetDates)} initialEmployeeId={employeeId} />
  </section>;
}
