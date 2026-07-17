import { ConfirmedHoursClient } from "@/components/ConfirmedHoursClient";
import { getWeekData } from "@/lib/week-data";

export default async function ConfirmedHoursPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const week = getWeekData(weekId);

  return (
    <section className="space-y-6">
      <div className="page-heading">
        <p className="eyebrow">Weekly summary</p>
        <h1>Confirmed hours</h1>
        <p>Week starting {week.weekStarting}. Only complete, confirmed actual shifts are shown.</p>
      </div>
      <ConfirmedHoursClient weekStarting={week.weekStarting} shifts={week.shifts} />
    </section>
  );
}
