import { WeekNavigation } from "@/components/WeekNavigation";
import { getWeeks } from "@/lib/week-data";

export default async function WeekLayout({ children, params }: { children: React.ReactNode; params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const weeks = getWeeks().slice().reverse();

  return (
    <>
      <WeekNavigation weekId={weekId} weeks={weeks} />
      {children}
    </>
  );
}
