import Link from "next/link";
import type { ReactNode } from "react";
import { formatDuration } from "@/domain/reconciliation";
import type { PublishedSnapshot } from "@/lib/sync/projection";
import {
  dashboardPeriods, dashboardUrl, dashboardViews, publishedHoursHistory, publishedHoursRanking,
  publishedPeriodLabel, publishedShiftsForPeriod, publishedSubtotal, publishedWeekComparison,
  resolveDashboardSelection, type PublishedShift
} from "@/lib/hosted/hours";
import { HostedLogout } from "./HostedAuthClient";

type Selection = ReturnType<typeof resolveDashboardSelection>;
const display = (minutes: number | null) => minutes == null ? "—" : formatDuration(minutes);

function Metric({ label, children, detail }: { label: string; children: ReactNode; detail?: string }) {
  return <div className="rounded-lg border border-stone-200 bg-white p-4">
    <p className="eyebrow">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{children}</p>
    {detail ? <p className="mt-1 text-xs text-stone-500">{detail}</p> : null}
  </div>;
}

function EmployeeLink({ id, name }: { id: string; name: string }) {
  return <Link href={dashboardUrl({ view: "employees", employee: id })}>{name}</Link>;
}

function Filters({ selection }: { selection: Selection }) {
  const weekly = selection.view === "weeks" || selection.view === "payroll";
  return <form action="/dashboard" method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4" aria-label="Dashboard filters">
    <input type="hidden" name="view" value={selection.view} />
    {weekly ? <label className="grid min-w-48 max-w-full gap-1 text-sm font-semibold">Choose week
      <select className="min-w-0 max-w-full rounded border bg-white p-2" name="week" defaultValue={selection.week?.id ?? ""}>
        {selection.weeks.map(week => <option key={week.id} value={week.id}>Week starting {week.weekStarting}{!week.shifts.length && !week.payroll.length ? " · no verified hours" : ""}</option>)}
      </select>
    </label> : <>
      <label className="grid gap-1 text-sm font-semibold">Period
        <select className="rounded border bg-white p-2" name="period" defaultValue={selection.period}>
          {dashboardPeriods.map(period => <option key={period.value} value={period.value}>{period.label}</option>)}
        </select>
      </label>
      {selection.view === "hours" && selection.period !== "total" ? <label className="grid min-w-48 max-w-full gap-1 text-sm font-semibold">Choose {selection.period}
        <select className="min-w-0 max-w-full rounded border bg-white p-2" name="key" defaultValue={selection.key}>
          {selection.periods.map(key => <option key={key} value={key}>{publishedPeriodLabel(key, selection.period)}</option>)}
        </select>
      </label> : null}
    </>}
    <label className="grid min-w-48 max-w-full gap-1 text-sm font-semibold">Employee
      <select className="min-w-0 max-w-full rounded border bg-white p-2" name="employee" defaultValue={selection.employeeId}>
        <option value="">All employees</option>
        {selection.employees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select>
    </label>
    <button className="button-primary" type="submit">Apply filters</button>
    <Link className="p-2 text-sm" href={dashboardUrl({ view: selection.view })}>Reset</Link>
  </form>;
}

function ShiftMetrics({ shifts }: { shifts: PublishedShift[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Selected hours summary">
    <Metric label="Confirmed worked" detail="Net hours after breaks; confirmed subtotal only">{display(publishedSubtotal(shifts))}</Metric>
    <Metric label="Employees" detail="People with verified shift entries">{new Set(shifts.map(shift => shift.employeeId)).size}</Metric>
    <Metric label="Shift entries" detail="Split shifts are separate entries">{shifts.length}</Metric>
    <Metric label="Recorded days" detail="Distinct dates with verified hours">{new Set(shifts.map(shift => shift.date)).size}</Metric>
  </div>;
}

function DailyEntries({ shifts }: { shifts: PublishedShift[] }) {
  return <section className="overflow-hidden rounded-lg border bg-white" aria-label="Daily verified entries">
    <div className="border-b p-4"><h2 className="font-semibold">Daily verified entries</h2><p className="mt-1 text-sm text-stone-500">Net worked time from the local app. Clock times, original sheets, and review details are not included in this sync.</p></div>
    {shifts.length ? <div className="max-h-[32rem] overflow-auto"><table className="hours-table" aria-label="Verified shift entries">
      <thead><tr><th>Date</th><th>Employee</th><th>Confirmed worked</th></tr></thead>
      <tbody>{shifts.map(shift => <tr key={shift.id}>
        <td data-label="Date"><Link href={dashboardUrl({ view: "hours", period: "day", key: shift.date, employee: shift.employeeId })}>{shift.date}</Link></td>
        <td data-label="Employee"><EmployeeLink id={shift.employeeId} name={shift.employeeName} /></td>
        <td data-label="Confirmed worked">{display(shift.workedMinutes)}</td>
      </tr>)}</tbody>
    </table></div> : <p className="p-4 text-sm text-stone-500">No verified shifts for this selection. Missing records are not assumed to be zero.</p>}
  </section>;
}

function Ranking({ shifts, employeeId }: { shifts: PublishedShift[]; employeeId: string }) {
  // Rank against everyone before filtering, just like the local Hours explorer.
  const people = publishedHoursRanking(shifts).filter(person => !employeeId || person.employeeId === employeeId);
  return <section className="overflow-hidden rounded-lg border bg-white">
    <div className="border-b p-4"><h2 className="font-semibold">Employee hours ranking</h2><p className="mt-1 text-sm text-stone-500">Most confirmed hours first. Equal totals share a rank. Days worked counts distinct dates, not shift entries.</p></div>
    {people.length ? <div className="overflow-x-auto"><table className="hours-table" aria-label="Hours by employee">
      <thead><tr><th>Rank</th><th>Employee</th><th>Confirmed worked</th><th>Days worked</th><th>Shift entries</th></tr></thead>
      <tbody>{people.map(person => <tr key={person.employeeId}>
        <td data-label="Rank">#{person.rank}</td><td data-label="Employee"><EmployeeLink id={person.employeeId} name={person.employeeName} /></td>
        <td data-label="Confirmed worked" className="font-semibold">{display(person.workedMinutes)}</td>
        <td data-label="Days worked">{person.daysWorked}</td><td data-label="Shift entries">{person.shifts}</td>
      </tr>)}</tbody>
    </table></div> : <p className="p-4 text-sm text-stone-500">No verified hours for this employee and period.</p>}
  </section>;
}

function WeekView({ selection }: { selection: Selection }) {
  const week = selection.week;
  if (!week) return null;
  const rows = publishedWeekComparison(week).filter(row => !selection.employeeId || row.employeeId === selection.employeeId);
  const shifts = week.shifts.filter(shift => !selection.employeeId || shift.employeeId === selection.employeeId);
  const paidRows = rows.filter(row => row.paidMinutes != null);
  const compared = rows.filter(row => row.differenceMinutes != null);
  const index = selection.weeks.findIndex(item => item.id === week.id);
  const weekUrl = (id: string) => dashboardUrl({ view: selection.view, week: id, employee: selection.employeeId });
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Week starting {week.weekStarting}</h2>
      <nav className="flex gap-4 text-sm" aria-label="Private week navigation">
        {selection.weeks[index + 1] ? <Link href={weekUrl(selection.weeks[index + 1].id)}>← Earlier week</Link> : null}
        {selection.weeks[index - 1] ? <Link href={weekUrl(selection.weeks[index - 1].id)}>Later week →</Link> : null}
      </nav>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Selected week summary">
      <Metric label="Confirmed worked" detail={`${shifts.length} verified shift entries`}>{display(publishedSubtotal(shifts))}</Metric>
      <Metric label="Verified paid" detail={`${paidRows.length} employees with verified paid hours`}>{display(paidRows.length ? paidRows.reduce((sum, row) => sum + row.paidMinutes!, 0) : null)}</Metric>
      <Metric label="Comparable difference" detail={`Confirmed subtotal minus paid, for ${compared.length} paired employees only`}>{display(compared.length ? compared.reduce((sum, row) => sum + row.differenceMinutes!, 0) : null)}</Metric>
      <Metric label="Recorded days" detail="Does not prove the entire week is complete">{new Set(shifts.map(shift => shift.date)).size}</Metric>
    </div>
    <section className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b p-4"><h2 className="font-semibold">{selection.view === "payroll" ? "Verified paid-hours breakdown" : "Actual versus paid hours"}</h2>
        <p className="mt-1 text-sm text-stone-500">Unavailable values remain blank (—), not zero. Differences compare confirmed subtotals only and may change after local review.</p></div>
      {rows.length ? <div className="overflow-x-auto"><table className="hours-table" aria-label={selection.view === "payroll" ? "Verified payroll by employee" : "Weekly employee comparison"}>
        <thead><tr><th>Employee</th>{selection.view === "payroll" ? <><th>Ordinary paid</th><th>Sunday paid</th><th>Other paid</th></> : <><th>Days worked</th><th>Shift entries</th></>}<th>Confirmed worked</th><th>Verified paid</th><th>Subtotal difference</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.employeeId}>
          <td data-label="Employee"><EmployeeLink id={row.employeeId} name={row.employeeName} />
            {!row.payroll ? <p className="mt-1 text-xs text-amber-800">Paid hours unavailable or not yet verified</p> : null}
            {row.payroll && row.payroll.totalPaidMinutes !== row.payroll.ordinaryPaidMinutes + row.payroll.sundayPaidMinutes + row.payroll.otherPaidMinutes ? <p className="mt-1 text-xs text-amber-800">Paid categories differ from the recorded total</p> : null}
          </td>
          {selection.view === "payroll" ? <><td data-label="Ordinary paid">{display(row.payroll?.ordinaryPaidMinutes ?? null)}</td><td data-label="Sunday paid">{display(row.payroll?.sundayPaidMinutes ?? null)}</td><td data-label="Other paid">{display(row.payroll?.otherPaidMinutes ?? null)}</td></> : <><td data-label="Days worked">{row.daysWorked ?? "—"}</td><td data-label="Shift entries">{row.shifts ?? "—"}</td></>}
          <td data-label="Confirmed worked">{display(row.workedMinutes)}</td><td data-label="Verified paid">{display(row.paidMinutes)}</td>
          <td data-label="Subtotal difference" className={row.differenceMinutes != null && row.differenceMinutes > 0 ? "font-semibold text-amber-800" : undefined}>{display(row.differenceMinutes)}</td>
        </tr>)}</tbody>
      </table></div> : <p className="p-4 text-sm text-stone-500">No verified hours available for this week.</p>}
    </section>
    {selection.view === "payroll" ? <p className="text-sm text-stone-500">Paid hours are recorded by source week, not allocated to individual days or calendar months. Verify all paid-minute values locally to make them available here.</p> : <>
      <details className="rounded-lg border bg-white p-4"><summary className="cursor-pointer font-semibold">Verified daily hours ({shifts.length} entries)</summary><div className="mt-4"><DailyEntries shifts={[...shifts].sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName))} /></div></details>
      <details className="rounded-lg border bg-white p-4"><summary className="cursor-pointer font-semibold">Browse all {selection.weeks.length} synced weeks</summary>
        <div className="mt-4 grid max-h-96 gap-3 overflow-y-auto sm:grid-cols-2">{selection.weeks.map(item => <Link key={item.id} href={weekUrl(item.id)} aria-current={item.id === week.id ? "page" : undefined} className={`dashboard-action ${item.id === week.id ? "border-stone-600" : ""}`}>
          <strong>Week starting {item.weekStarting}</strong><span>{item.shifts.length} verified shifts · {display(publishedSubtotal(item.shifts))} confirmed · {item.payroll.length} verified paid entries</span>
        </Link>)}</div>
      </details>
    </>}
  </>;
}

function HoursView({ selection }: { selection: Selection }) {
  const allShifts = publishedShiftsForPeriod(selection.weeks, selection.period, selection.key);
  const shifts = allShifts.filter(shift => !selection.employeeId || shift.employeeId === selection.employeeId);
  const index = selection.periods.indexOf(selection.key);
  const periodUrl = (key: string) => dashboardUrl({ view: "hours", period: selection.period, key, employee: selection.employeeId });
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{publishedPeriodLabel(selection.key, selection.period)}</h2>
      {selection.period !== "total" ? <nav className="flex gap-4 text-sm" aria-label="Private hours period navigation">
        {selection.periods[index + 1] ? <Link href={periodUrl(selection.periods[index + 1])}>← Earlier period</Link> : null}
        {selection.periods[index - 1] ? <Link href={periodUrl(selection.periods[index - 1])}>Later period →</Link> : null}
      </nav> : null}
    </div>
    <ShiftMetrics shifts={shifts} /><Ranking shifts={allShifts} employeeId={selection.employeeId} /><DailyEntries shifts={shifts} />
    <p className="text-sm text-stone-500">Periods use the recorded shift date. Overnight shifts belong to their start date. No document-coverage or review-completeness claims are inferred from verified data alone.</p>
  </>;
}

function EmployeesView({ selection }: { selection: Selection }) {
  const allShifts = publishedShiftsForPeriod(selection.weeks, "total", "total");
  const shifts = allShifts.filter(shift => !selection.employeeId || shift.employeeId === selection.employeeId);
  const person = selection.employees.find(employee => employee.id === selection.employeeId);
  const history = publishedHoursHistory(shifts, selection.period);
  const recent = history.slice(0, 12).reverse();
  const max = Math.max(1, ...recent.map(period => period.workedMinutes));
  return <>
    <div><p className="eyebrow">Employee history</p><h2 className="text-xl font-semibold">{person?.name ?? "All employees"}</h2>
      <p className="mt-1 text-sm text-stone-500">All synced verified shifts, grouped by {selection.period === "total" ? "all time" : selection.period}. {shifts.length ? `Recorded dates ${shifts.at(-1)!.date} to ${shifts[0].date}.` : "No verified shift history available."}</p></div>
    <ShiftMetrics shifts={shifts} />
    {recent.length ? <section className="rounded-lg border bg-white p-4" aria-label="Hours history chart"><h2 className="font-semibold">Recent confirmed hours</h2><p className="mt-1 text-sm text-stone-500">Up to 12 recorded periods; absent periods are not assumed to be zero.</p>
      <ol className="mt-4 grid gap-3">{recent.map(period => <li key={period.key} className="grid gap-1"><div className="flex justify-between gap-3 text-sm"><span>{period.label}</span><strong>{display(period.workedMinutes)}</strong></div>
        <div className="h-2 overflow-hidden rounded bg-stone-100" aria-hidden="true"><div className="h-full rounded bg-emerald-700" style={{ width: `${period.workedMinutes / max * 100}%` }} /></div>
      </li>)}</ol>
    </section> : null}
    <section className="overflow-hidden rounded-lg border bg-white"><div className="border-b p-4"><h2 className="font-semibold">Confirmed hours history</h2></div>
      {history.length ? <div className="max-h-[32rem] overflow-auto"><table className="hours-table" aria-label="Employee hours history"><thead><tr><th>Period</th><th>Confirmed worked</th><th>Recorded days</th><th>Shift entries</th></tr></thead>
        <tbody>{history.map(period => <tr key={period.key}><td data-label="Period"><Link href={dashboardUrl({ view: "hours", period: selection.period, key: period.key, employee: selection.employeeId })}>{period.label}</Link></td><td data-label="Confirmed worked">{display(period.workedMinutes)}</td><td data-label="Recorded days">{period.daysWorked}</td><td data-label="Shift entries">{period.shifts}</td></tr>)}</tbody>
      </table></div> : <p className="p-4 text-sm text-stone-500">No verified shift history for this employee.</p>}
    </section>
    <Ranking shifts={allShifts} employeeId={selection.employeeId} />
  </>;
}

export function HostedDashboard({ snapshot, receivedAt, query }: { snapshot: PublishedSnapshot | null; receivedAt: string | null; query: Record<string, string | string[] | undefined> }) {
  const selection = resolveDashboardSelection(snapshot?.weeks ?? [], query);
  return <div className="grid gap-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="page-heading"><p className="eyebrow">Private workspace · verified data only</p><h1>Verified hours</h1><p>Browse actual hours, employee history, and verified paid time.</p></div>
      <div className="flex items-center gap-3"><form action="/dashboard" method="get" aria-label="Refresh dashboard">
        <input type="hidden" name="view" value={selection.view} /><input type="hidden" name="period" value={selection.period} />
        <input type="hidden" name="key" value={selection.key} /><input type="hidden" name="employee" value={selection.employeeId} />
        <input type="hidden" name="week" value={selection.week?.id ?? ""} />
        <button className="button-secondary" type="submit">Refresh data</button>
      </form><HostedLogout /></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-3 text-sm">
      <p aria-label="Data last updated"><strong>Last updated:</strong> {receivedAt ? <time dateTime={receivedAt} title="Latest verified-data change accepted by the hosted database">{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC", timeZoneName: "short" }).format(new Date(receivedAt))}</time> : "Not yet synced"}</p>
      <p className="text-stone-500">Read-only · {selection.weeks.length} synced weeks · {selection.employees.length} employees with verified data</p>
    </div>
    <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Confirmed subtotals only. Unverified rows are excluded, so weeks may be incomplete. Differences are not salary, tax, or entitlement calculations. Photos and files remain local. Review and corrections happen in the local app.</p>
    <nav className="week-sections" aria-label="Private dashboard sections">{dashboardViews.map(view => <Link key={view.value} href={dashboardUrl({ view: view.value })} aria-current={selection.view === view.value ? "page" : undefined}>{view.label}</Link>)}</nav>
    {!snapshot || !snapshot.weeks.length ? <div className="empty-state">No verified data has been synced yet. Verification and corrections happen in the local app.</div> : <>
      <Filters key={`${selection.view}-${selection.period}-${selection.key}-${selection.employeeId}-${selection.week?.id}`} selection={selection} />
      {selection.view === "weeks" || selection.view === "payroll" ? <WeekView selection={selection} /> : selection.view === "hours" ? <HoursView selection={selection} /> : <EmployeesView selection={selection} />}
    </>}
  </div>;
}
