import { ConfirmedHoursClient } from "@/components/ConfirmedHoursClient";
import { getWeekData } from "@/lib/week-data";
import { missingDailySheetDates } from "@/lib/week-coverage";

export default async function ConfirmedHoursPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const week = getWeekData(weekId);

  return (
    <section className="space-y-6">
      <div className="page-heading">
        <p className="eyebrow">Weekly summary</p>
        <h1>Confirmed hours</h1>
        <p>Week starting {week.weekStarting}. Choose a day or the whole week to see each employee’s worked hours. Only complete, confirmed actual shifts count toward totals.</p>
      </div>
      <ConfirmedHoursClient key={week.id} weekId={week.id} weekStarting={week.weekStarting} shifts={week.shifts} missingDates={missingDailySheetDates(week)} />
    </section>
  );
}
