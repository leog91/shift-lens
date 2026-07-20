"use client";

import { useState } from "react";
import { formatDuration, type PayrollInput } from "@/domain/reconciliation";

interface Employee {
  id: string;
  displayName: string;
}

type Draft = { ordinaryPaidMinutes: string; sundayPaidMinutes: string; otherPaidMinutes: string; displayedTotalPaidMinutes: string };

function draftFor(entry: PayrollInput | undefined): Draft {
  return {
    ordinaryPaidMinutes: String(entry?.ordinaryPaidMinutes ?? 0),
    sundayPaidMinutes: String(entry?.sundayPaidMinutes ?? 0),
    otherPaidMinutes: String(entry?.otherPaidMinutes ?? 0),
    displayedTotalPaidMinutes: entry?.displayedTotalPaidMinutes == null ? "" : String(entry.displayedTotalPaidMinutes)
  };
}

export function PayrollEntriesClient({ weekId, employees, payroll, readOnly }: { weekId: string; employees: Employee[]; payroll: PayrollInput[]; readOnly: boolean }) {
  const [entries, setEntries] = useState(() => new Map(payroll.map((entry) => [entry.employeeId, entry])));
  const [drafts, setDrafts] = useState(() => new Map(employees.map((employee) => [employee.id, draftFor(entries.get(employee.id))])));
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const people = employees.filter((employee) => employee.id);

  function updateDraft(employeeId: string, field: keyof Draft, value: string) {
    setDrafts((current) => new Map(current).set(employeeId, { ...current.get(employeeId)!, [field]: value }));
  }

  async function save(employee: Employee) {
    const draft = drafts.get(employee.id)!;
    const values = [draft.ordinaryPaidMinutes, draft.sundayPaidMinutes, draft.otherPaidMinutes];
    if (values.some((value) => !/^\d+$/.test(value))) {
      setMessages((current) => ({ ...current, [employee.id]: "Paid minutes must be non-negative whole numbers." }));
      return;
    }
    if (draft.displayedTotalPaidMinutes && !/^\d+$/.test(draft.displayedTotalPaidMinutes)) {
      setMessages((current) => ({ ...current, [employee.id]: "Displayed total must be a non-negative whole number." }));
      return;
    }
    setSaving(employee.id);
    setMessages((current) => ({ ...current, [employee.id]: "" }));
    try {
      const payload = {
        weekId,
        employeeId: employee.id,
        ordinaryPaidMinutes: Number(draft.ordinaryPaidMinutes),
        sundayPaidMinutes: Number(draft.sundayPaidMinutes),
        otherPaidMinutes: Number(draft.otherPaidMinutes),
        displayedTotalPaidMinutes: draft.displayedTotalPaidMinutes ? Number(draft.displayedTotalPaidMinutes) : null
      };
      const response = await fetch("/api/payroll/upsert", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to save payroll entry.");
      setEntries((current) => new Map(current).set(employee.id, { ...payload, employeeName: employee.displayName }));
      setMessages((current) => ({ ...current, [employee.id]: "Saved." }));
    } catch (error) {
      setMessages((current) => ({ ...current, [employee.id]: error instanceof Error ? error.message : "Unable to save payroll entry." }));
    } finally {
      setSaving(null);
    }
  }

  if (people.length === 0) return <div className="empty-state">Add an employee before entering paid hours.</div>;
  return <div className="grid gap-3">{people.map((employee) => {
    const draft = drafts.get(employee.id) ?? draftFor(entries.get(employee.id));
    const entry = entries.get(employee.id);
    return <section className="rounded border bg-white p-4" key={employee.id}>
      <h2 className="font-semibold">{employee.displayName}</h2>
      {readOnly ? <p className="mt-1 text-sm">{entry ? `Ordinary ${formatDuration(entry.ordinaryPaidMinutes)} | Sunday ${formatDuration(entry.sundayPaidMinutes)} | Other ${formatDuration(entry.otherPaidMinutes)} | Displayed total ${formatDuration(entry.displayedTotalPaidMinutes ?? 0)}` : "No paid-hours entry."}</p> : <>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(["ordinaryPaidMinutes", "sundayPaidMinutes", "otherPaidMinutes", "displayedTotalPaidMinutes"] as const).map((field) => <label className="grid gap-1 text-sm" key={field}>{field === "ordinaryPaidMinutes" ? "Ordinary minutes" : field === "sundayPaidMinutes" ? "Sunday minutes" : field === "otherPaidMinutes" ? "Other minutes" : "Displayed total minutes (optional)"}<input className="rounded border p-2" min="0" onChange={(event) => updateDraft(employee.id, field, event.target.value)} type="number" value={draft[field]} /></label>)}
        </div>
        <button className="mt-3 rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving === employee.id} onClick={() => save(employee)} type="button">{saving === employee.id ? "Saving..." : entry ? "Save paid hours" : "Add paid hours"}</button>
        {messages[employee.id] ? <p className="mt-2 text-sm text-stone-700" role="status">{messages[employee.id]}</p> : null}
      </>}
    </section>;
  })}</div>;
}
