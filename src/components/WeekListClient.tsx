"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateManualWeekForm({ readOnly }: { readOnly: boolean }) {
  const router = useRouter();
  const [weekStarting, setWeekStarting] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function createWeek() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/weeks/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekStarting }) });
      const result = await response.json() as { ok: boolean; weekId?: string; error?: string };
      if (!response.ok || !result.ok || !result.weekId) throw new Error(result.error ?? "Unable to create week.");
      router.push(`/weeks/${result.weekId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create week.");
    } finally {
      setSaving(false);
    }
  }

  if (readOnly) return null;
  return <section className="rounded-lg border bg-white p-4">
    <h2 className="font-semibold">Create week manually</h2>
    <p className="mt-1 text-sm text-stone-600">Start a document-free week for fully manual time and paid-hours entry.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <input aria-label="Week starting date" className="rounded border p-2 text-sm" onChange={(event) => setWeekStarting(event.target.value)} type="date" value={weekStarting} />
      <button className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !weekStarting} onClick={createWeek} type="button">{saving ? "Creating week..." : "Create week"}</button>
    </div>
    <p className="mt-2 text-xs text-stone-600">Week starting dates must be Mondays.</p>
    {message ? <p className="mt-2 text-sm text-red-700" role="status">{message}</p> : null}
  </section>;
}
