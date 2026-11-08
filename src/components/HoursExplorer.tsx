"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDuration, type ShiftInput } from "@/domain/reconciliation";
import { confirmedWorkedMinutes, employeeHoursRanking, employeeHoursSummary } from "@/lib/confirmed-hours";
import { availableHoursPeriods, hoursPaperCoverage, shiftsForPeriod, type HoursPeriodView } from "@/lib/hours-explorer";
import { HoursPaperCoverage } from "./HoursPaperCoverage";

const views: { value: HoursPeriodView; label: string }[] = [
  { value: "day", label: "Day" }, { value: "week", label: "Week" },
  { value: "month", label: "Month" }, { value: "year", label: "Year" }, { value: "total", label: "All time" }
];

function periodLabel(key: string, view: HoursPeriodView) {
  if (view === "total") return "All loaded records";
  if (view === "year") return key;
  if (view === "week") return `Week starting ${key}`;
  return new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", ...(view === "month" ? { month: "long", year: "numeric" } : { weekday: "short", day: "numeric", month: "short", year: "numeric" }) }).format(new Date(`${key}${view === "month" ? "-01" : ""}T00:00:00Z`));
}

export function HoursExplorer({ shifts, weekStarts, missingDates, initialEmployeeId = "" }: { shifts: ShiftInput[]; weekStarts: string[]; missingDates: string[]; initialEmployeeId?: string }) {
  const [view, setView] = useState<HoursPeriodView>("week");
  const [selectedKey, setSelectedKey] = useState("");
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const periods = availableHoursPeriods(weekStarts, shifts, view);
  const key = periods.includes(selectedKey) ? selectedKey : periods[0] ?? "";
  const selectedShifts = shiftsForPeriod(shifts, view, key);
  const people = employeeHoursRanking(selectedShifts).filter(person => !employeeId || person.employeeId === employeeId);
  const employees = employeeHoursSummary(shifts);
  const total = people.reduce((sum, person) => sum + (person.minutes ?? 0), 0);
  const confirmedPeople = people.filter(person => person.minutes != null).length;
  const reviewRows = people.reduce((sum, person) => sum + person.reviewRows, 0);
  const coverage = hoursPaperCoverage(weekStarts, missingDates, view, key);
  const workedDays = new Set(selectedShifts.filter(shift => (!employeeId || shift.employeeId === employeeId) && confirmedWorkedMinutes(shift) != null).map(shift => shift.date)).size;

  return <section className="space-y-4" aria-labelledby="hours-explorer-heading">
    <h2 className="text-lg font-semibold" id="hours-explorer-heading">Employee hours ranking</h2>
    <div className="hours-toolbar">
      <label className="grid gap-1 text-sm font-semibold">Period
        <select className="rounded border border-stone-300 bg-white p-2" value={view} onChange={event => { setView(event.target.value as HoursPeriodView); setSelectedKey(""); }}>
          {views.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {view !== "total" ? <label className="grid gap-1 text-sm font-semibold">Choose {view}
        <select className="rounded border border-stone-300 bg-white p-2" value={key} onChange={event => setSelectedKey(event.target.value)}>
          {periods.map(period => {
            const papers = hoursPaperCoverage(weekStarts, missingDates, view, period);
            return <option key={period} value={period}>{periodLabel(period, view)} — {papers.missingDates.length ? `${papers.missingDates.length} paper${papers.missingDates.length === 1 ? "" : "s"} missing` : papers.expectedDates.length ? "papers present" : "coverage unknown"}</option>;
          })}
        </select>
      </label> : null}
      <label className="grid gap-1 text-sm font-semibold">Employee
        <select className="rounded border border-stone-300 bg-white p-2" value={employeeId} onChange={event => setEmployeeId(event.target.value)}>
          <option value="">All employees</option>
          {employees.map(person => <option key={person.employeeId} value={person.employeeId}>{person.employeeName}</option>)}
        </select>
      </label>
    </div>
    <HoursPaperCoverage {...coverage} />
    <section className="hours-person" aria-label="Selected period hours">
      <div className="hours-person-header">
        <h3 className="font-semibold">{key ? periodLabel(key, view) : "No loaded records"}</h3>
        <span>Confirmed total <strong>{formatDuration(total)}</strong></span>
      </div>
      <p className="px-4 pt-4 text-sm text-stone-600">Most confirmed hours first. Equal hours share a rank. {confirmedPeople} {confirmedPeople === 1 ? "employee" : "employees"} with confirmed hours across <strong>{workedDays} distinct {workedDays === 1 ? "day" : "days"}</strong>. {reviewRows} {reviewRows === 1 ? "row" : "rows"} excluded pending review.</p>
      {people.length ? <div className="overflow-x-auto">
        <table className="hours-table" aria-label="Hours by employee">
          <thead><tr><th>Rank</th><th>Employee</th><th>Confirmed worked hours</th><th>Days worked</th><th>Review</th></tr></thead>
          <tbody>{people.map(person => <tr key={person.employeeId}>
            <td data-label="Rank">{person.rank == null ? "—" : `#${person.rank}`}</td>
            <td data-label="Employee"><Link href={`/employees/${person.employeeId}`}>{person.employeeName}</Link></td>
            <td data-label="Confirmed worked hours" className="font-semibold">{person.minutes == null ? "—" : formatDuration(person.minutes)}</td>
            <td data-label="Days worked">{person.minutes == null ? "—" : person.daysWorked}</td>
            <td data-label="Review">{person.reviewRows ? `${person.reviewRows} excluded pending review` : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="p-4 text-sm text-stone-600">No recorded shifts for this selection. Missing hours are not assumed to be zero.</p>}
      <p className="p-4 text-sm text-stone-600">Confirmed actual hours from loaded records only, after breaks. Days worked counts distinct dates with complete confirmed shifts, not the number of shifts; split shifts count as one day. Unconfirmed and incomplete shifts are excluded. Overnight shifts belong to their recorded start date.</p>
    </section>
  </section>;
}
