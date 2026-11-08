import { HoursExplorer } from "@/components/HoursExplorer";
import { getAllWeekData } from "@/lib/week-data";
import { missingDailySheetDates } from "@/lib/week-coverage";

export default function HoursPage() {
  const weeks = getAllWeekData();
  return <section className="space-y-6">
    <div className="page-heading"><p className="eyebrow">Worked hours</p><h1>Employee hours</h1><p>Rank employees by confirmed worked hours for a day, week, month, year, or all time.</p></div>
    <HoursExplorer shifts={weeks.flatMap(week => week.shifts)} weekStarts={weeks.map(week => week.weekStarting)} missingDates={weeks.flatMap(missingDailySheetDates)} />
  </section>;
}
