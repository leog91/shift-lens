import { formatDuration } from "@/domain/reconciliation";
import { confirmedWorkedMinutes } from "@/lib/confirmed-hours";
import { getAllWeekData } from "@/lib/week-data";

export default function AnalyticsPage() {
  const weeklyHours = getAllWeekData().map((week) => {
    const shifts = week.shifts.flatMap((shift) => {
      const minutes = confirmedWorkedMinutes(shift);
      return minutes == null ? [] : [minutes];
    });
    return { id: week.id, weekStarting: week.weekStarting, shifts: shifts.length, minutes: shifts.reduce((sum, minutes) => sum + minutes, 0) };
  }).filter((week) => week.weekStarting).sort((a, b) => b.weekStarting.localeCompare(a.weekStarting));
  const totalMinutes = weeklyHours.reduce((sum, week) => sum + week.minutes, 0);
  const maxMinutes = Math.max(...weeklyHours.map((week) => week.minutes), 1);

  return <section className="space-y-6"><div className="page-heading"><p className="eyebrow">All employees</p><h1>Team analytics</h1><p>Confirmed actual hours across all loaded weeks. This is separate from employee history and individual weekly records.</p></div><div className="hours-stat-grid"><div className="hours-stat"><span>Confirmed total</span><strong>{formatDuration(totalMinutes)}</strong></div><div className="hours-stat"><span>Weeks loaded</span><strong>{weeklyHours.length}</strong></div><div className="hours-stat"><span>Average week</span><strong>{weeklyHours.length ? formatDuration(Math.round(totalMinutes / weeklyHours.length)) : "-"}</strong></div><div className="hours-stat"><span>Confirmed shifts</span><strong>{weeklyHours.reduce((sum, week) => sum + week.shifts, 0)}</strong></div></div>{weeklyHours.length === 0 ? <div className="empty-state">No complete confirmed shifts are available yet.</div> : <><section className="hours-overview" aria-labelledby="team-history-heading"><div className="hours-overview-heading"><div><p className="eyebrow">Weekly pattern</p><h2 id="team-history-heading">Hours by week</h2></div><span>{formatDuration(totalMinutes)} confirmed</span></div><div className="week-chart" role="img" aria-label={`Team confirmed hours across ${weeklyHours.length} weeks.`}>{weeklyHours.slice().reverse().map((week) => <div className="week-chart-item" key={week.id}><strong>{formatDuration(week.minutes)}</strong><div className="week-chart-track"><span style={{ height: `${(week.minutes / maxMinutes) * 100}%` }} /></div><span>{week.weekStarting.slice(5)}</span></div>)}</div></section><section className="hours-overview"><div className="overflow-x-auto"><table className="hours-table"><thead><tr><th>Week starting</th><th>Confirmed shifts</th><th>Total worked</th></tr></thead><tbody>{weeklyHours.map((week) => <tr key={week.id}><td data-label="Week starting">{week.weekStarting}</td><td data-label="Confirmed shifts">{week.shifts}</td><td data-label="Total worked" className="font-semibold">{formatDuration(week.minutes)}</td></tr>)}</tbody></table></div></section></>}</section>;
}
