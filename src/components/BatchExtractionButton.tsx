"use client";

import { useState } from "react";

export function BatchExtractionButton({ weekId, dailySheetCount, unprocessedDocuments, reviewOnlyDocuments }: { weekId: string; dailySheetCount: number; unprocessedDocuments: number; reviewOnlyDocuments: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [failures, setFailures] = useState<Array<{ filename: string; error: string }>>([]);
  const [running, setRunning] = useState(false);

  async function runBatchExtraction() {
    const startedAt = Date.now();
    setRunning(true);
    setMessage(null);
    setFailures([]);
    try {
      const response = await fetch("/api/extraction/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekId })
      });
      const result = await response.json() as { ok: boolean; error?: string; processedDocuments?: number; results?: Array<{ filename: string; createdRows: number; error?: string }> };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Batch extraction failed.");
      const createdRows = result.results?.reduce((total, item) => total + item.createdRows, 0) ?? 0;
      const failedDocuments = result.results?.flatMap((item) => item.error ? [{ filename: item.filename, error: item.error }] : []) ?? [];
      setFailures(failedDocuments);
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      setMessage(createdRows > 0 ? `OCR completed in ${elapsedSeconds}s: processed ${result.processedDocuments ?? 0} paper(s) and added ${createdRows} needs-checking row(s)${failedDocuments.length ? `; ${failedDocuments.length} failed` : ""}.` : `OCR completed in ${elapsedSeconds}s but found no usable time rows. Check the photo type, crop, and employee aliases${failedDocuments.length ? `; ${failedDocuments.length} paper(s) failed` : ""}.`);
      if (createdRows > 0) window.setTimeout(() => window.location.reload(), 3500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch extraction failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded border bg-white p-4">
      <p className="text-sm text-stone-700">{dailySheetCount} daily sheet{dailySheetCount === 1 ? "" : "s"} available to rescan.</p>
      <p className="mt-1 text-sm text-stone-700">{unprocessedDocuments} daily sheet{unprocessedDocuments === 1 ? "" : "s"} without rows.</p>
      <p className="mt-1 text-sm text-stone-700">{reviewOnlyDocuments} daily sheet{reviewOnlyDocuments === 1 ? "" : "s"} with OCR rows ready for verification or refresh.</p>
      <button className="mt-2 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={running || dailySheetCount === 0} onClick={runBatchExtraction} type="button">{running ? "Running local OCR. This can take about a minute..." : "Rescan papers and add missing OCR rows"}</button>
      <p className="mt-2 text-xs text-stone-600">Uses local OCR. Start it with <code>bun run dev:ocr</code>. Confirmed and manually corrected rows are preserved; only uncertain OCR rows refresh. Every new OCR row is marked needs checking and excluded from totals.</p>
      {message ? <p className="mt-2 text-sm text-amber-900">{message}</p> : null}
      {failures.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">{failures.map((failure) => <li key={failure.filename}><span className="font-medium">{failure.filename}:</span> {failure.error}</li>)}</ul> : null}
    </div>
  );
}
