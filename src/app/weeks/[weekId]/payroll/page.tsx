import { getWeekData } from "@/lib/week-data";
import { isLocalDataMode } from "@/lib/data-mode";
import { PayrollEntriesClient } from "@/components/PayrollEntriesClient";

export default async function PayrollPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const week = getWeekData(weekId);
  return <section className="space-y-4"><div><h1 className="text-3xl font-bold">Payroll entries</h1><p className="text-stone-600">Enter paid time manually in integer minutes. ShiftLens compares these values but does not calculate payroll.</p></div><PayrollEntriesClient employees={week.employees} payroll={week.payroll} readOnly={!isLocalDataMode()} weekId={week.id} /></section>;
}
