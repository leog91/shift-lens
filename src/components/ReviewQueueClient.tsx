"use client";

import { useState, useTransition } from "react";
import { documentUrl } from "@/lib/document-url";

interface ReviewItemView {
  id: string;
  employeeName: string;
  filename: string;
  documentPath?: string;
  reviewType?: string;
  raw: string | null;
  proposed: string | null;
  reason: string;
}

export function ReviewQueueClient({ weekId, reviewItems, readOnly = false }: { weekId: string; reviewItems: ReviewItemView[]; readOnly?: boolean }) {
  const [items, setItems] = useState(reviewItems);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function confirm(item: ReviewItemView) {
    startTransition(async () => {
      setErrors((current) => ({ ...current, [item.id]: "" }));
      const response = await fetch("/api/review/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekId, reviewItemId: item.id, confirmedValue: values[item.id] ?? "" })
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setErrors((current) => ({ ...current, [item.id]: result.error ?? "Unable to confirm." }));
        return;
      }
      setItems((current) => current.filter((reviewItem) => reviewItem.id !== item.id));
    });
  }

  if (items.length === 0) return <div className="rounded border bg-white p-4 text-green-700">Review queue is clear. Refresh comparison to see updated totals.</div>;

  return (
    <div className="space-y-4">
      {readOnly ? <div className="demo-notice" role="note"><strong>Demo account</strong><span>Confirming review values is available only in a local profile.</span></div> : null}
      {items.map((item) => {
        const placeholder = item.reviewType === "paid_hours" ? "Decimal paid hours, e.g. 24.08" : item.reviewType === "break_minutes" ? "Confirmed break minutes, e.g. 0 or 15" : "Confirmed value";
        return (
          <article className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-[360px_1fr]" key={item.id}>
            <div className="space-y-2">
              <div className="overflow-hidden rounded border bg-stone-100">
                 {item.documentPath ? <img alt={`Source document ${item.filename}`} className="max-h-[420px] w-full object-contain" src={documentUrl(item.documentPath)} /> : <div className="flex h-36 items-center justify-center text-stone-500">Source image unavailable</div>}
              </div>
               {item.documentPath ? <a className="text-sm" href={documentUrl(item.documentPath)} target="_blank">Open full document</a> : null}
            </div>
            <div className="space-y-2">
              <h2 className="font-semibold">{item.employeeName}</h2>
              <p>File: {item.filename}</p>
              <p>Raw OCR: {item.raw ?? "null"}</p>
              <p>Proposed: {item.proposed ?? "null"}</p>
              <p className="text-amber-800">{item.reason}</p>
               <input className="w-full max-w-md rounded border p-2" disabled={readOnly} onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={placeholder} value={values[item.id] ?? ""} />
              {errors[item.id] ? <p className="text-sm text-red-700">{errors[item.id]}</p> : null}
              <div className="flex flex-wrap gap-2">
                 <span title={readOnly ? "Demo account: editing is disabled." : undefined}><button className="rounded bg-blue-700 px-3 py-2 text-white disabled:opacity-50" disabled={readOnly || isPending} onClick={() => confirm(item)} type="button">Save confirmed value</button></span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
