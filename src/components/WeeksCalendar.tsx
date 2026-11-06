import { adjacentMonth, calendarDateLabel, monthWeeks, type SheetDay } from "@/lib/week-calendar";
import type { getWeeks } from "@/lib/week-data";

type WeekSummary = ReturnType<typeof getWeeks>[number];

export function SheetDayTile({ day, weekId, outsideMonth = false }: { day: SheetDay; weekId: string; outsideMonth?: boolean }) {
  const loaded = day.sheetCount > 0;
  const label = calendarDateLabel(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return <a className={`sheet-day ${loaded ? "loaded" : "missing"}${outsideMonth ? " outside-month" : ""}`} href={loaded ? `/weeks/${weekId}/actual?date=${day.date}` : `/weeks/${weekId}/documents`} aria-label={`${label}: ${loaded ? `${day.sheetCount} daily sheet${day.sheetCount === 1 ? "" : "s"}, ${day.reviewRows} rows to check` : "Missing sheet. Open documents"}`}>
    <time className="sheet-day-date" dateTime={day.date}>{calendarDateLabel(day.date, { day: "numeric", ...(outsideMonth ? { month: "short" } : {}) })}</time>
    <svg className="sheet-day-icon" aria-hidden="true" viewBox="0 0 24 28" fill="none"><path d="M5 1h10l6 6v19H3V1h2Z" stroke="currentColor" strokeWidth="1.3" /><path d="M15 1v7h6M7 13h10M7 17h10M7 21h6" stroke="currentColor" strokeWidth="1.3" /></svg>
    <span className="sheet-day-status">{loaded ? (day.sheetCount > 1 ? `${day.sheetCount} sheets` : "Sheet loaded") : "Missing sheet"}</span>
    {loaded ? <small>{day.reviewRows > 0 ? `${day.reviewRows} to check` : day.recordedRows === 0 ? "No rows yet" : "Open sheet →"}</small> : <small>Add document →</small>}
  </a>;
}

export function WeekSheetGrid({ weekId, days }: { weekId: string; days: SheetDay[] }) {
  return <section className="week-sheets-panel" aria-label="Daily sheets">
    <div className="section-title"><div><p className="eyebrow">Monday to Sunday</p><h2>Daily sheets</h2></div><span>{days.filter(d => d.sheetCount > 0).length}/7 days loaded</span></div>
    <div className="calendar-scroll" tabIndex={0} role="region" aria-label="Seven daily sheets, scroll horizontally on small screens"><div className="week-sheets-grid">{days.map(day => <div key={day.date}><p className="sheet-weekday">{calendarDateLabel(day.date, { weekday: "short" })}</p><SheetDayTile day={day} weekId={weekId} /></div>)}</div></div>
    <p className="calendar-note">Sheet availability only. Loaded sheets may still contain hours that need review.</p>
  </section>;
}

export function WeeksCalendar({ weeks, month }: { weeks: WeekSummary[]; month: string }) {
  const byStart = new Map(weeks.map(week => [week.weekStarting, week]));
  const rows = monthWeeks(month);
  const monthLabel = calendarDateLabel(`${month}-01`, { month: "long", year: "numeric" });
  const loadedDays = weeks.flatMap(w => w.days).filter(d => d.date.startsWith(month) && d.sheetCount > 0).length;
  const recordedWeeks = rows.filter(dates => byStart.has(dates[0])).length;
  return <section className="calendar-panel" aria-label="Monthly sheet calendar">
    <div className="calendar-toolbar">
      <div><p className="eyebrow">Monthly evidence</p><h2>{monthLabel}</h2><p>{loadedDays} days with sheets · {recordedWeeks} recorded week{recordedWeeks === 1 ? "" : "s"}</p></div>
      <div className="calendar-controls">
        <nav className="calendar-month-nav" aria-label="Calendar month"><a href={`/weeks?view=calendar&month=${adjacentMonth(month, -1)}`} aria-label="Previous month">←</a><a href={`/weeks?view=calendar&month=${adjacentMonth(month, 1)}`} aria-label="Next month">→</a></nav>
        <form action="/weeks"><input name="view" type="hidden" value="calendar" /><input aria-label="Calendar month" name="month" type="month" defaultValue={month} key={month} required /><button className="button-secondary" type="submit">Go</button></form>
      </div>
    </div>
    <div className="calendar-legend"><span><i className="legend-loaded" />Sheet loaded</span><span><i className="legend-missing" />Missing sheet</span><span><i className="legend-empty" />No week recorded</span></div>
    <p className="calendar-mobile-hint">Swipe across to see all seven days.</p>
    <div className="calendar-scroll" tabIndex={0} role="region" aria-label={`${monthLabel} calendar, scroll horizontally on small screens`}>
      <table className="weeks-calendar">
        <caption className="sr-only">{monthLabel}. Weeks start on Monday. Sheet availability does not confirm worked hours.</caption>
        <thead><tr><th scope="col">Week</th>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <th key={day} scope="col">{day}</th>)}</tr></thead>
        <tbody>{rows.map(dates => {
          const week = byStart.get(dates[0]);
          return <tr key={dates[0]}>
            <th scope="row" className="calendar-week-summary">{week ? <a href={`/weeks/${week.id}`}><span>Week of</span><strong>{calendarDateLabel(dates[0], { day: "numeric", month: "short" })}</strong><span className="calendar-week-count">{7 - week.missingDailySheetDates.length}/7 days loaded</span><span className="calendar-open-week">Open week →</span></a> : <div><span>Week of</span><strong>{calendarDateLabel(dates[0], { day: "numeric", month: "short" })}</strong><span>No week recorded</span></div>}</th>
            {dates.map(date => {
              const day = week?.days.find(d => d.date === date);
              return <td key={date}>{week && day ? <SheetDayTile day={day} weekId={week.id} outsideMonth={!date.startsWith(month)} /> : <div className={`sheet-day empty${!date.startsWith(month) ? " outside-month" : ""}`}><time className="sheet-day-date" dateTime={date}>{calendarDateLabel(date, { day: "numeric", ...(!date.startsWith(month) ? { month: "short" } : {}) })}</time><span className="sheet-day-status">No week</span></div>}</td>;
            })}
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="calendar-note">Loaded means a daily sheet is attached—not that its hours are confirmed. Open a day to review its paper, or open a week for the full record.</p>
  </section>;
}
