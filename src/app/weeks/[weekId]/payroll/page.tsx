import { formatDuration } from "@/domain/reconciliation";
import { getWeekData } from "@/lib/week-data";

export default async function PayrollPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const { payroll } = getWeekData(weekId);
  return <section className="space-y-4"><h1 className="text-3xl font-bold">Payroll entries</h1><div className="grid gap-3">{payroll.map((p) => <div className="rounded border bg-white p-4" key={p.employeeId}><h2 className="font-semibold">{p.employeeName}</h2><p>Ordinary {formatDuration(p.ordinaryPaidMinutes)} | Sunday {formatDuration(p.sundayPaidMinutes)} | Other {formatDuration(p.otherPaidMinutes)} | Displayed total {formatDuration(p.displayedTotalPaidMinutes ?? 0)}</p></div>)}</div></section>;
}
