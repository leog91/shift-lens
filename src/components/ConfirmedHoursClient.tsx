"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDuration, workedMinutes, type ShiftInput } from "@/domain/reconciliation";
import { employeeHoursRanking, employeeHoursSummary } from "@/lib/confirmed-hours";
import { weekDates } from "@/lib/week-coverage";
import { HoursPaperCoverage } from "./HoursPaperCoverage";

type ConfirmedShift = Omit<ShiftInput, "startTime" | "finishTime" | "breakMinutes"> & {
  startTime: string;
  finishTime: string;
  breakMinutes: number;
  totalMinutes: number;
};

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`));
}

function shareText(periodLabel: string, shifts: ConfirmedShift[], daily: boolean) {
  const byEmployee = new Map<string, ConfirmedShift[]>();
  for (const shift of shifts) {
    const employeeShifts = byEmployee.get(shift.employeeId) ?? [];
    employeeShifts.push(shift);
    byEmployee.set(shift.employeeId, employeeShifts);
  }

  return [
    `Shift details | ${periodLabel}`,
    ...[...byEmployee.values()].sort((a, b) => a[0].employeeName.localeCompare(b[0].employeeName)).flatMap((employeeShifts) => {
      const total = employeeShifts.reduce((sum, shift) => sum + shift.totalMinutes, 0);
      return [
        "",
        employeeShifts[0].employeeName,
        ...employeeShifts.map((shift) => `${formatDay(shift.date)}: ${shift.startTime}–${shift.finishTime}, ${shift.breakMinutes} min break, ${formatDuration(shift.totalMinutes)}`),
        `${daily ? "Day" : "Week"} total: ${formatDuration(total)}`
      ];
    })
  ].join("\n");
}

export function ConfirmedHoursClient({ weekId, weekStarting, shifts, missingDates }: { weekId: string; weekStarting: string; shifts: ShiftInput[]; missingDates: string[] }) {
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const dates = weekDates(weekStarting);
  const weekShifts = shifts.filter(shift => dates.includes(shift.date));
  const employees = employeeHoursSummary(weekShifts);
  const selectedShifts = weekShifts.filter(shift => !employeeId || shift.employeeId === employeeId);
  const summary = employeeHoursRanking(weekShifts, date || undefined).filter(person => !employeeId || person.employeeId === employeeId);
  const periodLabel = date ? formatDay(date) : `Week starting ${weekStarting}`;
  const periodMinutes = summary.reduce((total, person) => total + (person.minutes ?? 0), 0);
  const reviewRows = summary.reduce((total, person) => total + person.reviewRows, 0);
  const confirmedShifts: ConfirmedShift[] = selectedShifts.filter(shift => !date || shift.date === date).flatMap((shift) => {
    const { startTime, finishTime, breakMinutes } = shift;
    if ((shift.status !== "confirmed" && shift.status !== "manually_entered") || startTime == null || finishTime == null || breakMinutes == null) return [];
    const totalMinutes = workedMinutes(startTime, finishTime, breakMinutes);
    return totalMinutes == null ? [] : [{ ...shift, startTime, finishTime, breakMinutes, totalMinutes }];
  })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName) || a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const people = new Map<string, ConfirmedShift[]>();
  for (const shift of confirmedShifts) {
    const personShifts = people.get(shift.employeeId) ?? [];
    personShifts.push(shift);
    people.set(shift.employeeId, personShifts);
  }

  async function share() {
    const text = shareText(periodLabel, confirmedShifts, Boolean(date));
    const summaryText = [`Confirmed hours | ${periodLabel}`, ...summary.map(person => `${person.employeeName}: ${person.minutes == null ? "No confirmed hours" : formatDuration(person.minutes)}${date ? ` (week: ${person.weekMinutes == null ? "No confirmed hours" : formatDuration(person.weekMinutes)})` : ""}${person.reviewRows ? ` — ${person.reviewRows} row(s) excluded pending review` : ""}`)].join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: `Confirmed hours: ${periodLabel}`, text: `${summaryText}\n\n${text}` });
        setShareStatus("Shared.");
      } else {
        await navigator.clipboard.writeText(`${summaryText}\n\n${text}`);
        setShareStatus("Copied to clipboard.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Could not share these hours.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="hours-toolbar no-print">
        <label className="grid gap-1 text-sm font-semibold">Day or week
          <select className="rounded border border-stone-300 bg-white p-2" value={date} onChange={event => { setDate(event.target.value); setShareStatus(null); }}>
            <option value="">Whole week</option>
            {dates.map(day => <option key={day} value={day}>{formatDay(day)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">Employee
          <select className="rounded border border-stone-300 bg-white p-2" value={employeeId} onChange={event => { setEmployeeId(event.target.value); setShareStatus(null); }}>
            <option value="">All employees</option>
            {employees.map(person => <option key={person.employeeId} value={person.employeeId}>{person.employeeName}</option>)}
          </select>
        </label>
      </div>

      <HoursPaperCoverage expectedDates={date ? [date] : dates} missingDates={missingDates.filter(day => !date || day === date)} />
      <section className="hours-person" aria-labelledby="hours-summary-heading">
        <div className="hours-person-header">
          <h2 id="hours-summary-heading">{periodLabel}</h2>
          <span>Confirmed total <strong>{formatDuration(periodMinutes)}</strong></span>
        </div>
        {summary.length === 0 ? <p className="p-4 text-sm text-stone-600">No recorded shifts for this selection. Missing hours are not assumed to be zero.</p> : (
          <div className="overflow-x-auto">
            <table className="hours-table" aria-label="Employee hours summary">
              <thead><tr><th>Rank</th><th>Employee</th><th>{date ? "Day hours" : "Week hours"}</th>{date ? <th>Week hours</th> : null}<th>Days worked</th><th>Review</th></tr></thead>
              <tbody>{summary.map(person => <tr key={person.employeeId}>
                <td data-label="Rank">{person.rank == null ? "—" : `#${person.rank}`}</td>
                <td data-label="Employee"><Link href={`/employees/${person.employeeId}`}>{person.employeeName}</Link></td>
                <td data-label={date ? "Day hours" : "Week hours"} className="font-semibold">{person.minutes == null ? "—" : formatDuration(person.minutes)}</td>
                {date ? <td data-label="Week hours">{person.weekMinutes == null ? "—" : formatDuration(person.weekMinutes)}</td> : null}
                <td data-label="Days worked">{person.minutes == null ? "—" : person.daysWorked}</td>
                <td data-label="Review">{person.reviewRows ? `${person.reviewRows} excluded pending review` : "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        {reviewRows ? <p className="p-4 text-sm text-amber-800">Unconfirmed or incomplete rows are excluded from totals. <Link href={`/weeks/${weekId}/actual${date ? `?date=${date}` : ""}`}>Review recorded hours</Link>.</p> : null}
      </section>
      <div className="hours-toolbar no-print">
        <p>{confirmedShifts.length} confirmed shift{confirmedShifts.length === 1 ? "" : "s"} across {people.size} {people.size === 1 ? "person" : "people"}.</p>
        <div className="flex flex-wrap gap-2">
          <button className="button-secondary" onClick={() => window.print()} type="button">Print</button>
          <button className="button-primary" onClick={share} type="button">Share hours</button>
        </div>
        {shareStatus ? <p className="w-full text-xs text-stone-600" role="status">{shareStatus}</p> : null}
      </div>

      {people.size === 0 ? (
        <div className="empty-state">No complete confirmed shifts are available for this selection yet.</div>
      ) : (
        <div className="confirmed-hours-list">
            {[...people.entries()].map(([personId, personShifts]) => {
              const total = personShifts.reduce((sum, shift) => sum + shift.totalMinutes, 0);
              return (
                <section className="hours-person" key={personId}>
                  <div className="hours-person-header">
                    <h2>{personShifts[0].employeeName}</h2>
                    <span>{date ? "Day total" : "Week total"} <strong>{formatDuration(total)}</strong></span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="hours-table">
                      <thead>
                        <tr><th>Day</th><th>Start</th><th>Finish</th><th>Break</th><th>Total</th></tr>
                      </thead>
                      <tbody>
                        {personShifts.map((shift) => (
                          <tr key={shift.id}>
                            <td data-label="Day"><Link className="hours-day-link" href={`/weeks/${weekId}/actual?date=${shift.date}`} title="View this day’s paper and recorded hours">{formatDay(shift.date)}<span className="no-print" aria-hidden="true"> ↗</span><span className="sr-only"> — view paper and recorded hours</span></Link></td>
                            <td data-label="Start">{shift.startTime}</td>
                            <td data-label="Finish">{shift.finishTime}</td>
                            <td data-label="Break">{shift.breakMinutes} min</td>
                            <td data-label="Total" className="font-semibold">{formatDuration(shift.totalMinutes)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
