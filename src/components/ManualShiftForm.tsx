"use client";

import { useState } from "react";

interface Employee {
  id: string;
  displayName: string;
}

export function ManualShiftForm({ weekId, weekStarting, employees }: { weekId: string; weekStarting: string; employees: Employee[] }) {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(weekStarting);
  const [startTime, setStartTime] = useState("");
  const [finishTime, setFinishTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const weekEnd = new Date(`${weekStarting}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  async function addShift() {
    const parsedBreak = Number(breakMinutes);
    if (!Number.isInteger(parsedBreak) || parsedBreak < 0) {
      setMessage("Break must be a non-negative integer number of minutes.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/shifts/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekId, employeeId, date, startTime, finishTime, breakMinutes: parsedBreak })
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to add manual shift.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add manual shift.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="rounded-lg border bg-white p-4">
    <h2 className="font-semibold">Add actual shift manually</h2>
    <p className="mt-1 text-sm text-stone-600">Use this when no usable paper image is available. Complete entries are included in confirmed-hour totals.</p>
    {employees.length === 0 ? <p className="mt-3 text-sm text-amber-900">Add an employee before entering a shift.</p> : <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select aria-label="Employee for manual shift" className="rounded border p-2 text-sm" onChange={(event) => setEmployeeId(event.target.value)} value={employeeId}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}</select>
        <input aria-label="Date for manual shift" className="rounded border p-2 text-sm" max={weekEnd.toISOString().slice(0, 10)} min={weekStarting} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        <input aria-label="Start time for manual shift" className="rounded border p-2 text-sm" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
        <input aria-label="Finish time for manual shift" className="rounded border p-2 text-sm" onChange={(event) => setFinishTime(event.target.value)} type="time" value={finishTime} />
        <input aria-label="Break minutes for manual shift" className="rounded border p-2 text-sm" min="0" onChange={(event) => setBreakMinutes(event.target.value)} placeholder="Break minutes" type="number" value={breakMinutes} />
      </div>
      <button className="mt-3 rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !employeeId || !date || !startTime || !finishTime} onClick={addShift} type="button">{saving ? "Adding shift..." : "Add confirmed manual shift"}</button>
    </>}
    {message ? <p className="mt-2 text-sm text-red-700" role="status">{message}</p> : null}
  </section>;
}
