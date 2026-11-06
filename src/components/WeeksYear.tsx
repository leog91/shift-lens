import { calendarDateLabel, yearWeekGroups } from "@/lib/week-calendar";
import { weekDates } from "@/lib/week-coverage";
import type { getWeeks } from "@/lib/week-data";

type WeekSummary = ReturnType<typeof getWeeks>[number];

function dateRange(start: string) {
  const end = weekDates(start)[6];
  const crossesYear = start.slice(0, 4) !== end.slice(0, 4);
  return `${calendarDateLabel(start, { day: "numeric", month: "short" })} – ${calendarDateLabel(end, { day: "numeric", month: "short", ...(crossesYear ? { year: "numeric" } : {}) })}`;
}

export function WeeksYear({ weeks, year }: { weeks: WeekSummary[]; year: string }) {
  const months = yearWeekGroups(weeks, year);
  const recorded = months.reduce((total, month) => total + month.weeks.length, 0);
  const complete = months.reduce((total, month) => total + month.completeWeeks, 0);
  return <section className="year-panel" aria-label="Yearly weeks overview">
    <div className="calendar-toolbar">
      <div><p className="eyebrow">Year at a glance</p><h2>{year} · Weekly sheets</h2><p>{recorded} recorded week{recorded === 1 ? "" : "s"} · {complete} with all seven daily sheets</p></div>
      <div className="calendar-controls">
        <nav className="calendar-month-nav" aria-label="Overview year">
          {Number(year) > 1000 ? <a href={`/weeks?view=year&year=${Number(year) - 1}`} aria-label="Previous year">←</a> : null}
          {Number(year) < 9998 ? <a href={`/weeks?view=year&year=${Number(year) + 1}`} aria-label="Next year">→</a> : null}
        </nav>
        <form action="/weeks"><input name="view" type="hidden" value="year" /><input aria-label="Overview year" className="year-input" name="year" type="number" min="1000" max="9998" step="1" defaultValue={year} key={year} required /><button className="button-secondary" type="submit">Go</button></form>
      </div>
    </div>
    <nav className="year-month-jumps" aria-label="Jump to month">{months.map(month => <a href={`#year-month-${month.month}`} key={month.month}>{calendarDateLabel(`${month.month}-01`, { month: "short" })}</a>)}</nav>
    <table className="year-weeks-table">
      <caption className="sr-only">{year} weekly sheet coverage by month. Month totals show complete weeks out of recorded weeks. Weekly totals show days with sheets out of seven.</caption>
      <thead><tr><th scope="col">Week</th><th scope="col">Date range</th><th scope="col">Coverage</th></tr></thead>
      {months.map(month => <tbody key={month.month} id={`year-month-${month.month}`}>
        <tr className="year-month-row">
          <th scope="rowgroup" colSpan={2}><div className="year-month-heading"><a href={`/weeks?view=calendar&month=${month.month}`}>{calendarDateLabel(`${month.month}-01`, { month: "long" })}</a><span>{month.weeks.length} recorded week{month.weeks.length === 1 ? "" : "s"}</span></div></th>
          <td><span className={`year-month-total${month.weeks.length > 0 && month.completeWeeks === month.weeks.length ? " complete" : ""}`} aria-label={`${month.completeWeeks} of ${month.weeks.length} recorded weeks have all seven sheets`}>{month.weeks.length ? `${month.completeWeeks}/${month.weeks.length}` : "—"}</span><small>weeks complete</small></td>
        </tr>
        {month.weeks.length ? month.weeks.map((week, index) => <tr className="year-week-row" key={week.id}>
          <th scope="row"><a href={`/weeks/${week.id}`} aria-label={`Open week starting ${week.weekStarting}`}>Week {index + 1}</a></th>
          <td>{dateRange(week.weekStarting)}</td>
          <td><span className={`year-sheet-count${week.missingDailySheetDates.length === 0 ? " complete" : ""}`} aria-label={`${7 - week.missingDailySheetDates.length} of 7 days have daily sheets`}>{7 - week.missingDailySheetDates.length}/7</span></td>
        </tr>) : <tr className="year-empty-row"><td colSpan={3}>No weeks recorded</td></tr>}
      </tbody>)}
    </table>
    <p className="calendar-note">Months count complete weeks out of recorded weeks; weekly rows count days with sheets out of seven. Weeks are grouped by their Monday start date and listed oldest first. Sheet coverage does not confirm worked hours.</p>
  </section>;
}
