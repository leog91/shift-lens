import { formatDuration } from "@/domain/reconciliation";
import { getAllWeekData } from "@/lib/week-data";
import { hoursHistory } from "@/lib/hours-history";
import { HoursHistory } from "@/components/HoursHistory";

export default function AnalyticsPage() {
  const weeks = getAllWeekData();
  const periods = { week: hoursHistory(weeks, "week"), month: hoursHistory(weeks, "month"), year: hoursHistory(weeks, "year") };
  const totalMinutes = periods.week.reduce((sum, week) => sum + week.minutes, 0);

  return <section className="space-y-6">
    <div className="page-heading"><p className="eyebrow">All employees</p><h1>Team analytics</h1><p>Confirmed actual hours across all loaded weeks. This is separate from employee history and individual weekly records.</p></div>
    <div className="hours-stat-grid">
      <div className="hours-stat"><span>Confirmed total</span><strong>{formatDuration(totalMinutes)}</strong></div>
      <div className="hours-stat"><span>Weeks loaded</span><strong>{periods.week.length}</strong></div>
      <div className="hours-stat"><span>Average week</span><strong>{periods.week.length ? formatDuration(Math.round(totalMinutes / periods.week.length)) : "-"}</strong></div>
      <div className="hours-stat"><span>Confirmed shifts</span><strong>{periods.week.reduce((sum, week) => sum + week.shifts, 0)}</strong></div>
    </div>
    {periods.week.length === 0 ? <div className="empty-state">No complete confirmed shifts are available yet.</div> : <HoursHistory periods={periods} name="Team" headingId="team-history-heading" />}
  </section>;
}
