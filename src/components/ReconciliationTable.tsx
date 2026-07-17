import { compareActualAndPaid, formatDuration, type PayrollInput, type ShiftInput } from "@/domain/reconciliation";

export function ReconciliationTable({ shifts, payroll, openReviewCount = 0, priorityEmployeeId }: { shifts: ShiftInput[]; payroll: PayrollInput[]; openReviewCount?: number; priorityEmployeeId?: string }) {
  const rows = compareActualAndPaid(shifts, payroll).sort((a, b) => {
    const aIsPriority = a.employeeId === priorityEmployeeId;
    const bIsPriority = b.employeeId === priorityEmployeeId;
    if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;
    return 0;
  });
  if (rows.length === 0) return <div className="rounded border bg-white p-4 text-stone-600">No confirmed local week data yet.</div>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <p className="border-b bg-stone-50 px-3 py-2 text-sm text-stone-600">Actual hours include confirmed paper rows only.</p>
      <table className="min-w-max w-full text-left text-sm">
        <thead className="bg-stone-100 text-stone-700">
          <tr>
            <th className="p-3">Employee</th>
            <th className="p-3 text-right">Actual Mon-Sat</th>
            <th className="p-3 text-right">Paid Mon-Sat</th>
            <th className="p-3 text-right">Actual Sunday</th>
            <th className="p-3 text-right">Paid Sunday</th>
            <th className="p-3 text-right">Actual Total</th>
            <th className="p-3 text-right">Paid Total</th>
            <th className="p-3 text-right">Difference</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t" key={row.employeeId}>
              <td className="p-3 font-medium">{row.employeeName}</td>
              <td className="p-3 text-right">{formatDuration(row.actualWeekdayMinutes)}</td>
              <td className="p-3 text-right">{formatDuration(row.paidWeekdayMinutes)}</td>
              <td className="p-3 text-right">{formatDuration(row.actualSundayMinutes)}</td>
              <td className="p-3 text-right">{formatDuration(row.paidSundayMinutes)}</td>
              <td className="p-3 text-right">{formatDuration(row.actualTotalMinutes)}</td>
              <td className="p-3 text-right">{formatDuration(row.paidTotalMinutes)}</td>
              <td className="p-3 text-right">{formatDuration(row.differenceMinutes)}</td>
              <td className="p-3"><span className="rounded bg-stone-100 px-2 py-1">{openReviewCount > 0 ? "needs_review" : row.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
