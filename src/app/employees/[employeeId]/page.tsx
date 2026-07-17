import Link from "next/link";
import { formatDuration } from "@/domain/reconciliation";
import { confirmedWorkedMinutes } from "@/lib/confirmed-hours";
import { getAllWeekData } from "@/lib/week-data";

export default async function EmployeeHoursPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  const weeks = getAllWeekData();
  const employee = weeks.flatMap((week) => week.employees).find((person) => person.id === employeeId);
  const weeklyHours = weeks.map((week) => {
    const shifts = week.shifts.flatMap((shift) => {
      if (shift.employeeId !== employeeId) return [];
      const minutes = confirmedWorkedMinutes(shift);
      return minutes == null ? [] : [minutes];
    });
    return { id: week.id, weekStarting: week.weekStarting, shifts: shifts.length, minutes: shifts.reduce((sum, minutes) => sum + minutes, 0) };
  }).filter((week) => week.minutes > 0).sort((a, b) => b.weekStarting.localeCompare(a.weekStarting));
  const totalMinutes = weeklyHours.reduce((sum, week) => sum + week.minutes, 0);
  const maxMinutes = Math.max(...weeklyHours.map((week) => week.minutes), 1);
  const name = employee?.displayName ?? "Employee";

  return (
    <section className="space-y-6">
      <div className="page-heading"><p className="eyebrow">Employee hours</p><h1>{name}</h1><p>Confirmed actual hours only. Uncertain and incomplete shifts are not included.</p></div>
      <div className="hours-stat-grid">
        <div className="hours-stat"><span>Confirmed total</span><strong>{formatDuration(totalMinutes)}</strong></div>
        <div className="hours-stat"><span>Weeks with hours</span><strong>{weeklyHours.length}</strong></div>
        <div className="hours-stat"><span>Average week</span><strong>{weeklyHours.length ? formatDuration(Math.round(totalMinutes / weeklyHours.length)) : "-"}</strong></div>
        <div className="hours-stat"><span>Aliases</span><strong>{employee?.aliases.length ?? 0}</strong></div>
      </div>
      {weeklyHours.length === 0 ? <div className="empty-state">No complete confirmed shifts are available for this employee yet.</div> : <>
        <section className="hours-overview" aria-labelledby="employee-history-heading">
          <div className="hours-overview-heading"><div><p className="eyebrow">History</p><h2 id="employee-history-heading">Hours by week</h2></div><span>{weeklyHours.length} recorded weeks</span></div>
          <div className="week-chart" role="img" aria-label={`${name}'s confirmed hours across ${weeklyHours.length} weeks.`}>{weeklyHours.slice().reverse().map((week) => <div className="week-chart-item" key={week.id}><strong>{formatDuration(week.minutes)}</strong><div className="week-chart-track"><span style={{ height: `${(week.minutes / maxMinutes) * 100}%` }} /></div><span>{week.weekStarting.slice(5)}</span></div>)}</div>
        </section>
        <section className="hours-overview" aria-labelledby="employee-weeks-heading">
          <div className="hours-overview-heading"><div><p className="eyebrow">Weekly record</p><h2 id="employee-weeks-heading">Confirmed hours</h2></div></div>
          <div className="overflow-x-auto"><table className="hours-table"><thead><tr><th>Week starting</th><th>Confirmed shifts</th><th>Total worked</th><th /></tr></thead><tbody>{weeklyHours.map((week) => <tr key={week.id}><td data-label="Week starting">{week.weekStarting}</td><td data-label="Confirmed shifts">{week.shifts}</td><td data-label="Total worked" className="font-semibold">{formatDuration(week.minutes)}</td><td data-label=""><Link href={`/weeks/${week.id}/hours`}>Open week</Link></td></tr>)}</tbody></table></div>
        </section>
      </>}
    </section>
  );
}
