import { ReconciliationTable } from "@/components/ReconciliationTable";
import { getWeekData } from "@/lib/week-data";
import { getLocalSettings } from "@/lib/local-settings";

export default async function ComparisonPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const week = getWeekData(weekId);
  return <section className="space-y-4"><h1 className="text-3xl font-bold">Comparison</h1><p className="text-stone-600">Positive differences mean potentially missing paid hours. Negative differences mean extra paid hours.</p><ReconciliationTable shifts={week.shifts} payroll={week.payroll} openReviewCount={week.reviewItems.length} priorityEmployeeId={getLocalSettings().priorityEmployeeId} /></section>;
}
