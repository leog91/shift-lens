"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Week = { id: string; weekStarting: string };

const sections = [
  { href: "", label: "Overview" },
  { href: "/hours", label: "Confirmed hours" },
  { href: "/actual", label: "Actual shifts" },
  { href: "/review", label: "Review queue" },
  { href: "/comparison", label: "Comparison" },
  { href: "/documents", label: "Documents" },
  { href: "/roster", label: "Roster" },
  { href: "/payroll", label: "Payroll" }
];

export function WeekNavigation({ weekId, weeks }: { weekId: string; weeks: Week[] }) {
  const pathname = usePathname();
  const currentIndex = weeks.findIndex((week) => week.id === weekId);
  const previousWeek = currentIndex > 0 ? weeks[currentIndex - 1] : null;
  const nextWeek = currentIndex >= 0 && currentIndex < weeks.length - 1 ? weeks[currentIndex + 1] : null;
  const section = pathname.startsWith(`/weeks/${weekId}`) ? pathname.slice(`/weeks/${weekId}`.length) : "";
  const weekHref = (id: string) => `/weeks/${id}${section}`;

  return (
    <nav className="week-navigation" aria-label="Week navigation">
      <div className="week-navigation-top">
        <Link className="back-to-weeks" href="/weeks">All weeks</Link>
        <div className="week-switcher" aria-label="Change week">
          {previousWeek ? <Link href={weekHref(previousWeek.id)}>&larr; Previous week</Link> : <span />}
          <span>Week of {weeks[currentIndex]?.weekStarting ?? "unknown"}</span>
          {nextWeek ? <Link href={weekHref(nextWeek.id)}>Next week &rarr;</Link> : <span />}
        </div>
      </div>
      <div className="week-sections">
        {sections.map((section) => <Link href={`/weeks/${weekId}${section.href}`} key={section.href || "overview"}>{section.label}</Link>)}
      </div>
    </nav>
  );
}
