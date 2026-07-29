import { getWeekData } from "@/lib/week-data";
import { documentUrl } from "@/lib/document-url";
import { RosterEstimatesClient } from "@/components/RosterEstimatesClient";
import { isLocalDataMode } from "@/lib/data-mode";

export default async function RosterPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const week = getWeekData(weekId);
  const rosterDocuments = week.documents.filter((document) => document.documentType === "roster");
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Roster</h1>
      <p className="text-stone-600">Roster rows are optional context only and never overwrite actual sheet values.</p>
      {rosterDocuments.map((document) => (
        <article className="rounded-lg border bg-white p-4" key={document.id}>
          <h2 className="font-semibold">Roster context for week starting {document.documentDate}</h2>
          <p className="break-all text-sm text-stone-600">{document.filename}</p>
          <img alt={document.filename} className="mt-3 max-h-[760px] w-full rounded border object-contain" src={documentUrl(document.path)} />
          <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">Use this only to find likely missing papers or check context. It does not count as actual worked time.</p>
        </article>
      ))}
      {rosterDocuments.length === 0 ? <div className="rounded border bg-white p-4 text-stone-600">No roster image loaded.</div> : null}
      <RosterEstimatesClient assignments={week.rosterAssignments ?? []} employees={week.employees} estimates={week.rosterEstimates ?? []} readOnly={!isLocalDataMode()} rosterDocuments={rosterDocuments.map(({ id, filename }) => ({ id, filename }))} weekId={week.id} weekStarting={week.weekStarting} />
    </section>
  );
}
