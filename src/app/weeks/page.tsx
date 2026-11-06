import { getWeeks } from "@/lib/week-data";
import { isLocalDataMode } from "@/lib/data-mode";
import { CreateManualWeekForm } from "@/components/WeekListClient";
import { WeeksCalendar } from "@/components/WeeksCalendar";
import { WeeksYear } from "@/components/WeeksYear";
import { isCalendarMonth, isCalendarYear } from "@/lib/week-calendar";

export const dynamic = "force-dynamic";

function weekRange(weekStarting: string) {
  const start = new Date(`${weekStarting}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const formatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export default async function WeeksPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string; year?: string }> }) {
  const weeks = getWeeks();
  const query = await searchParams;
  const calendar = query.view === "calendar";
  const yearly = query.view === "year";
  const month = query.month && isCalendarMonth(query.month) ? query.month : weeks[0]?.weekStarting.slice(0, 7) || new Date().toISOString().slice(0, 7);
  const year = query.year && isCalendarYear(query.year) ? query.year : month.slice(0, 4);
  const calendarMonth = yearly ? `${year}-${month.slice(5, 7)}` : month;
  return (
    <section className="space-y-6">
      <div className="page-heading">
        <p className="eyebrow">Weekly records</p>
        <h1>Weeks</h1>
        <p>Choose a week to review its source documents, confirmed actual hours, and comparison.</p>
      </div>
      <CreateManualWeekForm readOnly={!isLocalDataMode()} />
      <div className="weeks-view-toolbar">
        <p><strong>{weeks.length}</strong> recorded week{weeks.length === 1 ? "" : "s"}<span> · Browse your daily sheets</span></p>
        <nav className="weeks-view-switch" aria-label="Weeks view">
          <a aria-current={!calendar && !yearly ? "page" : undefined} href={`/weeks?view=list&month=${calendarMonth}&year=${year}`}><span aria-hidden="true">☰</span> List</a>
          <a aria-current={calendar ? "page" : undefined} href={`/weeks?view=calendar&month=${calendarMonth}`}><span aria-hidden="true">▦</span> Calendar</a>
          <a aria-current={yearly ? "page" : undefined} href={`/weeks?view=year&year=${year}&month=${month}`}><span aria-hidden="true">▤</span> Year</a>
        </nav>
      </div>
      {yearly ? <WeeksYear weeks={weeks} year={year} /> : calendar ? <WeeksCalendar weeks={weeks} month={month} /> : <>
      <div className="weeks-list">
        {weeks.length === 0 ? <div className="empty-state">No local week loaded.</div> : null}
        {weeks.map((week) => (
          <a className="week-card" href={`/weeks/${week.id}`} key={week.id}>
            <div className="week-card-main">
              <div>
                <p className="eyebrow">{weekRange(week.weekStarting)}</p>
                <h2>Week starting {week.weekStarting}</h2>
                <p className={week.missingDailySheetDates.length === 0 ? "week-coverage complete" : "week-coverage"}>{week.missingDailySheetDates.length === 0 ? "All daily sheets loaded" : `${week.missingDailySheetDates.length} daily sheet${week.missingDailySheetDates.length === 1 ? "" : "s"} still missing`}</p>
              </div>
              <span className={week.status === "confirmed" ? "week-status ready" : "week-status"}>{week.status.replace("_", " ")}</span>
            </div>
            <div className="week-card-footer">
              <div className="week-metrics">
                <span><strong>{7 - week.missingDailySheetDates.length}/7</strong> sheets</span>
                <span><strong>{week.documents}</strong> documents</span>
                {week.openReviewItems > 0 ? <span className="needs-attention"><strong>{week.openReviewItems}</strong> to review</span> : null}
                {week.discrepancies > 0 ? <span className="needs-attention"><strong>{week.discrepancies}</strong> differences</span> : null}
              </div>
              <span className="open-week">Open week <span aria-hidden="true">&rarr;</span></span>
            </div>
          </a>
        ))}
      </div>
      </>}
    </section>
  );
}
