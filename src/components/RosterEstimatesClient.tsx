"use client";

import { useState } from "react";
import { formatDuration, workedMinutes } from "@/domain/reconciliation";

interface Employee {
  id: string;
  displayName: string;
}

interface RosterDocument {
  id: string;
  filename: string;
}

interface RosterEstimate {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string;
  finishTime: string;
  breakMinutes: number | null;
  sourceDocument: string | null;
  status: "extracted" | "confirmed" | "manually_entered";
  rawFinishTime: string | null;
  reviewReason: string | null;
}

interface RosterAssignment {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  type: "standby" | "office";
  rawValue: string;
  sourceDocument: string;
}

export function RosterEstimatesClient({ weekId, weekStarting, employees, rosterDocuments, estimates, assignments = [], readOnly = false }: { weekId: string; weekStarting: string; employees: Employee[]; rosterDocuments: RosterDocument[]; estimates: RosterEstimate[]; assignments?: RosterAssignment[]; readOnly?: boolean }) {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(weekStarting);
  const [startTime, setStartTime] = useState("");
  const [finishTime, setFinishTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [sourceDocument, setSourceDocument] = useState(rosterDocuments[0]?.filename ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const weekEnd = new Date(`${weekStarting}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const totals = new Map<string, { name: string; minutes: number }>();
  for (const estimate of estimates) {
    const minutes = workedMinutes(estimate.startTime, estimate.finishTime, estimate.breakMinutes ?? 0);
    if (minutes == null) continue;
    const total = totals.get(estimate.employeeId) ?? { name: estimate.employeeName, minutes: 0 };
    total.minutes += minutes;
    totals.set(estimate.employeeId, total);
  }

  async function extractRoster() {
    if (!rosterDocuments[0]) return;
    const startedAt = Date.now();
    setExtracting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/roster-estimates/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekId, documentId: rosterDocuments[0].id }) });
      const result = await response.json() as { ok: boolean; error?: string; createdEstimates?: number; createdAssignments?: number; qualityWarnings?: string[] };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to extract roster.");
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const estimates = result.createdEstimates ?? 0;
      const assignments = result.createdAssignments ?? 0;
      const warnings = result.qualityWarnings?.length ? ` ${result.qualityWarnings.join(" ")}` : "";
      setMessage(estimates || assignments ? `OCR completed in ${elapsedSeconds}s: added ${estimates} shift proposal(s) and ${assignments} standby/office assignment(s). Review each row before confirmation.${warnings}` : `OCR completed in ${elapsedSeconds}s but did not identify any usable roster rows. Check the image type, employee aliases, and whether the roster grid is fully visible.${warnings}`);
      window.setTimeout(() => window.location.reload(), 3500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to extract roster.");
    } finally {
      setExtracting(false);
    }
  }

  async function addEstimate() {
    const parsedBreak = Number(breakMinutes);
    if (!Number.isInteger(parsedBreak) || parsedBreak < 0) {
      setMessage("Break must be a non-negative integer number of minutes.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/roster-estimates/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekId, employeeId, date, startTime, finishTime, breakMinutes: parsedBreak, sourceDocument: sourceDocument || null })
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to add roster estimate.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add roster estimate.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="rounded-lg border bg-white p-4">
    <h2 className="font-semibold">Estimated roster hours</h2>
    <p className="mt-1 text-sm text-stone-600">Transcribe a scheduled shift from the roster image to calculate an estimate. Roster breaks default to 0 minutes and can be edited during review. Estimates are separate from actual shifts and never affect confirmed totals or payroll comparison.</p>
    {!readOnly && rosterDocuments.length > 0 ? <button className="mt-3 rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={extracting} onClick={extractRoster} type="button">{extracting ? "Extracting roster..." : "Extract roster proposals"}</button> : null}
    {!readOnly && employees.length > 0 ? <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <select aria-label="Employee for roster estimate" className="rounded border p-2 text-sm" onChange={(event) => setEmployeeId(event.target.value)} value={employeeId}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}</select>
        <input aria-label="Date for roster estimate" className="rounded border p-2 text-sm" max={weekEnd.toISOString().slice(0, 10)} min={weekStarting} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        <input aria-label="Start time for roster estimate" className="rounded border p-2 text-sm" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
        <input aria-label="Finish time for roster estimate" className="rounded border p-2 text-sm" onChange={(event) => setFinishTime(event.target.value)} type="time" value={finishTime} />
        <input aria-label="Break minutes for roster estimate" className="rounded border p-2 text-sm" min="0" onChange={(event) => setBreakMinutes(event.target.value)} type="number" value={breakMinutes} />
        <select aria-label="Roster source for estimate" className="rounded border p-2 text-sm" onChange={(event) => setSourceDocument(event.target.value)} value={sourceDocument}><option value="">No source selected</option>{rosterDocuments.map((document) => <option key={document.filename} value={document.filename}>{document.filename}</option>)}</select>
      </div>
      <button className="mt-3 rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !employeeId || !date || !startTime || !finishTime} onClick={addEstimate} type="button">{saving ? "Adding estimate..." : "Add roster estimate"}</button>
    </> : !readOnly ? <p className="mt-3 text-sm text-amber-900">Add an employee before entering a roster estimate.</p> : null}
    {message ? <p className="mt-2 text-sm text-amber-900" role="status">{message}</p> : null}
    {estimates.length > 0 ? <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-left text-sm"><thead className="bg-stone-100 text-stone-700"><tr><th className="p-2">Employee</th><th className="p-2">Date</th><th className="p-2">Scheduled</th><th className="p-2">Estimate</th><th className="p-2">Review</th></tr></thead><tbody>{estimates.map((estimate) => <RosterEstimateRow estimate={estimate} key={estimate.id} readOnly={readOnly} weekId={weekId} />)}</tbody></table>
      </div>
      <div className="rounded bg-stone-50 p-3 text-sm"><h3 className="font-medium">Estimated weekly total</h3><dl className="mt-2 space-y-1">{[...totals.values()].sort((a, b) => a.name.localeCompare(b.name)).map((total) => <div className="flex justify-between gap-3" key={total.name}><dt>{total.name}</dt><dd className="font-medium">{formatDuration(total.minutes)}</dd></div>)}</dl></div>
    </div> : <p className="mt-4 text-sm text-stone-600">No roster estimates entered yet.</p>}
    {assignments.length ? <div className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-950"><h3 className="font-medium">Roster assignments needing manual time entry</h3><ul className="mt-2 space-y-1">{assignments.map((assignment) => <li key={assignment.id}>{assignment.date}: {assignment.employeeName} - {assignment.type === "standby" ? "standby/on-call" : "office work"} ({assignment.rawValue})</li>)}</ul><p className="mt-2">These assignment counts are not included in estimated hours.</p></div> : null}
  </section>;
}

function RosterEstimateRow({ estimate, weekId, readOnly }: { estimate: RosterEstimate; weekId: string; readOnly: boolean }) {
  const [breakMinutes, setBreakMinutes] = useState(String(estimate.breakMinutes ?? 0));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const minutes = workedMinutes(estimate.startTime, estimate.finishTime, estimate.breakMinutes ?? 0);
  async function confirm() {
    const parsedBreak = Number(breakMinutes);
    if (!Number.isInteger(parsedBreak) || parsedBreak < 0) return setMessage("Enter a whole-number break.");
    setSaving(true);
    const response = await fetch("/api/roster-estimates/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekId, estimateId: estimate.id, breakMinutes: parsedBreak }) });
    const result = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !result.ok) { setMessage(result.error ?? "Unable to confirm estimate."); setSaving(false); return; }
    window.location.reload();
  }
  return <tr className="border-t"><td className="p-2 font-medium">{estimate.employeeName}</td><td className="p-2">{estimate.date}</td><td className="p-2">{estimate.startTime} - {estimate.rawFinishTime ?? estimate.finishTime}</td><td className="p-2">{minutes == null ? "Break needed" : formatDuration(minutes)}</td><td className="p-2">{estimate.status === "extracted" && !readOnly ? <div className="space-y-1"><input aria-label={`Break minutes for ${estimate.employeeName} ${estimate.date}`} className="w-20 rounded border p-1" min="0" onChange={(event) => setBreakMinutes(event.target.value)} placeholder="Break" type="number" value={breakMinutes} /><button className="block rounded bg-stone-900 px-2 py-1 text-xs text-white disabled:opacity-50" disabled={saving || breakMinutes === ""} onClick={confirm} type="button">Confirm estimate</button><span className="block text-xs text-amber-800">{estimate.reviewReason}</span>{message ? <span className="block text-xs text-red-700">{message}</span> : null}</div> : <span>{estimate.status === "confirmed" ? "confirmed" : "manual"}</span>}</td></tr>;
}
