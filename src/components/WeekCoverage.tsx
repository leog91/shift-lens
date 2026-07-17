import { missingDailySheetDates } from "@/lib/week-coverage";
import type { LocalWeek } from "@/lib/week-data";

export function WeekCoverage({ week }: { week: LocalWeek }) {
  const missingDates = missingDailySheetDates(week);
  if (missingDates.length === 0) {
    return <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">All 7 daily sheets for this week are loaded.</div>;
  }
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Possible missing actual sheets</p>
      <p>This week starts {week.weekStarting}. I do not see daily sheet photos for: {missingDates.join(", ")}.</p>
      <p>If you have those papers, add them so the weekly actual total is complete.</p>
    </div>
  );
}
