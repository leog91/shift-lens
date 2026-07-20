import { DocumentUploadClient } from "@/components/DocumentUploadClient";
import { getWeekData } from "@/lib/week-data";
import { documentUrl } from "@/lib/document-url";
import { isLocalDataMode } from "@/lib/data-mode";

export default async function DocumentsPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const { documents } = getWeekData(weekId);
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Documents</h1>
      {documents.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((document) => (
            <article className="rounded-lg border bg-white p-3" key={document.id}>
              <div className="mb-2">
                <h2 className="font-semibold">{document.documentDate ?? "No date"} · {document.documentType}</h2>
                <p className="break-all text-sm text-stone-600">{document.filename}</p>
              </div>
              <img alt={document.filename} className="max-h-[520px] w-full rounded border object-contain" src={documentUrl(document.path)} />
              {document.qualityWarnings.length ? <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">{document.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            </article>
          ))}
        </div>
      ) : <div className="rounded border bg-white p-4 text-stone-600">No local documents loaded yet.</div>}
       {isLocalDataMode() ? <DocumentUploadClient /> : <div className="demo-notice" role="note"><strong>Demo account</strong><span>Uploading and processing documents is disabled. The fictional documents above are included for viewing.</span></div>}
    </section>
  );
}
