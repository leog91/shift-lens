"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDuration } from "@/domain/reconciliation";
import type { HoursPeriod, HoursView } from "@/lib/hours-history";

export function HoursHistory({ periods, name, headingId }: { periods: Record<HoursView, HoursPeriod[]>; name: string; headingId: string }) {
  const [view, setView] = useState<HoursView>("week");
  const items = periods[view];
  const plural = view === "week" ? "weeks" : view === "month" ? "months" : "years";
  const stepHours = Math.max(5, Math.ceil(Math.max(...items.map(item => item.minutes), 1) / 60 / 4 / 5) * 5);
  const scale = <div className="week-chart-axis" aria-hidden="true"><div>{Array.from({ length: 5 }, (_, index) => <span key={index} style={{ bottom: `${index * 25}%` }}>{index * stepHours}h</span>)}</div></div>;
  function coverage(item: HoursPeriod) {
    return item.missingDates.length ? `Possibly incomplete: ${item.missingDates.length} daily sheet${item.missingDates.length === 1 ? "" : "s"} missing (${item.missingDates.join(", ")}).` : view === "week" ? "All seven daily sheets present; hours shown are confirmed only." : "No missing daily sheets in loaded weeks; this does not confirm full calendar coverage.";
  }

  return <>
    <section className="hours-overview" aria-labelledby={headingId}>
      <div className="hours-overview-heading"><div><p className="eyebrow">History</p><h2 id={headingId}>Hours by {view}</h2></div><span>{items.length} recorded {plural}</span></div>
      <div className="hours-history-controls" role="group" aria-label="Hours grouping">{(["week", "month", "year"] as const).map(option => <button key={option} type="button" className={view === option ? "button-primary" : "button-secondary"} aria-pressed={view === option} onClick={() => setView(option)}>{option === "week" ? "Week" : option === "month" ? "Month" : "Year"}</button>)}</div>
      <div className="week-chart-with-axes">
        {scale}
        <div className="week-chart-scroll" tabIndex={0} role="region" aria-label={`${view === "week" ? "Weekly" : view === "month" ? "Monthly" : "Yearly"} hours chart, scroll horizontally to see all ${plural}`}>
          <div className="week-chart" role="list" aria-label={`${name}'s confirmed hours across ${items.length} ${plural}. Scale: 0 to ${stepHours * 4} hours.`}>{items.slice().reverse().map(item => <div className={`week-chart-item${item.missingDates.length ? " possibly-incomplete" : ""}`} key={item.id} role="listitem" aria-label={`${item.label}: ${formatDuration(item.minutes)} confirmed. ${coverage(item)}`} title={coverage(item)}><strong>{formatDuration(item.minutes)}</strong><div className="week-chart-track"><span style={{ height: `${item.minutes / (stepHours * 4 * 60) * 100}%` }} /></div><span>{item.shortLabel}{item.missingDates.length > 0 && <span aria-hidden="true"> *</span>}</span></div>)}</div>
        </div>
        {scale}
      </div>
      {items.some(item => item.missingDates.length > 0) && <p className="week-chart-note"><span className="week-chart-warning-key" aria-hidden="true" /> <strong>* Possibly incomplete</strong> — daily sheets are missing, so totals may be missing hours. This does not mean the employee worked on those days. Hover a bar for missing dates.</p>}
      {view !== "week" && <p className="week-chart-note">Confirmed hours from loaded records only, grouped by each shift’s date. Unrecorded days or weeks may be missing; this is not a complete calendar-coverage check. Uncertain and incomplete shifts remain excluded.</p>}
    </section>
    <section className="hours-overview" aria-labelledby={`${headingId}-totals`}>
      <div className="hours-overview-heading"><div><p className="eyebrow">{view === "week" ? "Weekly" : view === "month" ? "Monthly" : "Yearly"} record</p><h2 id={`${headingId}-totals`}>Confirmed hours</h2></div></div>
      <div className="overflow-x-auto"><table className="hours-table"><thead><tr><th>{view === "week" ? "Week starting" : view === "month" ? "Month" : "Year"}</th><th>Confirmed shifts</th><th>Total worked</th><th>Coverage</th>{view === "week" && <th />}</tr></thead><tbody>{items.map(item => <tr key={item.id}><td data-label="Period">{view === "week" ? item.id : item.label}</td><td data-label="Confirmed shifts">{item.shifts}</td><td data-label="Total worked" className="font-semibold">{formatDuration(item.minutes)}</td><td data-label="Coverage" title={coverage(item)}>{item.missingDates.length ? `${item.missingDates.length} missing sheets — possibly incomplete` : "Sheets present in loaded weeks"}</td>{view === "week" && <td>{item.weekId && <Link href={`/weeks/${item.weekId}/hours`}>Open week</Link>}</td>}</tr>)}</tbody></table></div>
    </section>
  </>;
}
