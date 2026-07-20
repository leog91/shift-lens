"use client";

import { useState } from "react";
import Link from "next/link";

interface Employee {
  id: string;
  displayName: string;
  aliases: string[];
}

export function EmployeeListClient({ initialEmployees, readOnly }: { initialEmployees: Employee[]; readOnly: boolean }) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [displayName, setDisplayName] = useState("");
  const [aliases, setAliases] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function createEmployee() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/employees/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, aliases: aliases.split(",").map((item) => item.trim()).filter(Boolean) })
      });
      const result = await response.json() as { ok: boolean; employee?: Employee; error?: string };
      if (!response.ok || !result.ok || !result.employee) throw new Error(result.error ?? "Unable to create employee.");
      setEmployees((current) => [...current, result.employee!]);
      setDisplayName("");
      setAliases("");
      setMessage("Employee added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create employee.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6">
    {!readOnly ? <section className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">Add employee</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input aria-label="Employee name" className="rounded border p-2" onChange={(event) => setDisplayName(event.target.value)} placeholder="Full name" value={displayName} />
        <input aria-label="Employee aliases" className="rounded border p-2" onChange={(event) => setAliases(event.target.value)} placeholder="Aliases, separated by commas (optional)" value={aliases} />
      </div>
      <button className="mt-3 rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !displayName.trim()} onClick={createEmployee} type="button">{saving ? "Adding employee..." : "Add employee"}</button>
      {message ? <p className="mt-2 text-sm text-stone-700" role="status">{message}</p> : null}
    </section> : null}
    {employees.length === 0 ? <div className="empty-state">No employees have been added yet.</div> : <div className="employee-list">
      {employees.slice().sort((a, b) => a.displayName.localeCompare(b.displayName)).map((employee) => <Link className="employee-card" href={`/employees/${employee.id}`} key={employee.id}>
        <div><h2>{employee.displayName}</h2><p>{employee.aliases.length ? `Also recorded as: ${employee.aliases.join(", ")}` : "No recorded aliases"}</p></div><span>View hours <span aria-hidden="true">&rarr;</span></span>
      </Link>)}
    </div>}
  </div>;
}
