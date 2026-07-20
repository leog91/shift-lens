import { getWeekData } from "@/lib/week-data";
import { ReviewQueueClient } from "@/components/ReviewQueueClient";
import { isLocalDataMode } from "@/lib/data-mode";

export default async function ReviewPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const { reviewItems } = getWeekData(weekId);
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Review queue</h1>
      <ReviewQueueClient readOnly={!isLocalDataMode()} reviewItems={reviewItems} />
    </section>
  );
}
