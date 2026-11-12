import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { dataMode } from "@/lib/data-mode";
import { authorizedCompany } from "@/lib/hosted/auth";
import { hostedDatabase } from "@/lib/hosted/database";
import { readPublishedSnapshot } from "@/lib/hosted/snapshots";
import { formatDuration } from "@/domain/reconciliation";
import { HostedLogout } from "@/components/HostedAuthClient";

export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  if (dataMode() !== "hosted") notFound();
  const company = await authorizedCompany(await headers());
  if (!company) redirect("/login");
  const published = await readPublishedSnapshot(hostedDatabase(), company);
  const display = (minutes: number | null) => minutes == null ? "—" : formatDuration(minutes);
  return <div className="grid gap-6">
    <div className="flex items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Verified hours</h1><HostedLogout /></div>
    <p className="text-sm">Read-only · Last synced: {published ? new Date(published.receivedAt).toISOString() : "Not yet synced"}. Refresh to load the latest data.</p>
    <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">Confirmed subtotals only. Unverified rows are excluded, so weeks may be incomplete. Differences are not salary, tax, or entitlement calculations. Photos and files are not hosted.</p>
    {!published || published.snapshot.weeks.length === 0 ? <p>No verified data has been synced yet. Verification and corrections happen in the local app.</p> : null}
    {published?.snapshot.weeks.slice().sort((a, b) => b.weekStarting.localeCompare(a.weekStarting)).map(week => {
      const people = new Map<string, { name: string; actual: number | null; paid: number | null }>();
      for (const shift of week.shifts) {
        const person = people.get(shift.employeeId) ?? { name: shift.employeeName, actual: null, paid: null };
        person.actual = (person.actual ?? 0) + shift.workedMinutes;
        people.set(shift.employeeId, person);
      }
      for (const pay of week.payroll) {
        const person = people.get(pay.employeeId) ?? { name: pay.employeeName, actual: null, paid: null };
        person.paid = pay.totalPaidMinutes;
        people.set(pay.employeeId, person);
      }
      return <section className="grid gap-3 rounded border bg-white p-4" key={week.id}>
        <h2 className="text-lg font-semibold">Week starting {week.weekStarting}</h2>
        {people.size === 0 ? <p>No verified hours available for this week.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr><th className="p-2">Employee</th><th className="p-2">Confirmed worked</th><th className="p-2">Verified paid</th><th className="p-2">Subtotal difference</th></tr></thead>
          <tbody>{[...people.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, person]) => <tr className="border-t" key={id}>
            <td className="p-2">{person.name}</td><td className="p-2">{display(person.actual)}</td><td className="p-2">{display(person.paid)}</td>
            <td className="p-2">{display(person.actual == null || person.paid == null ? null : person.actual - person.paid)}</td>
          </tr>)}</tbody>
        </table></div>}
        {week.shifts.length ? <details><summary className="cursor-pointer text-sm">Verified daily hours</summary><ul className="mt-2 grid gap-1 text-sm">{week.shifts.map(shift => <li key={shift.id}>{shift.date} · {shift.employeeName} · {display(shift.workedMinutes)}</li>)}</ul></details> : null}
      </section>;
    })}
  </div>;
}
