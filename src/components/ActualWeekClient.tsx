"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDuration, workedMinutes, type ShiftInput } from "@/domain/reconciliation";

interface LocalDocument {
  id: string;
  documentType: "daily_sheet" | "roster" | "payslip";
  documentDate: string | null;
  filename: string;
  path: string;
  qualityWarnings?: string[];
}

interface EmployeeOption {
  id: string;
  displayName: string;
}

export function ActualWeekClient({ weekId, documents, shifts, employees }: { weekId: string; documents: LocalDocument[]; shifts: ShiftInput[]; employees: EmployeeOption[] }) {
  const [localShifts, setLocalShifts] = useState(shifts);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, { startTime: string; finishTime: string; breakMinutes: string }>>({});
  const [selectedShiftByDocument, setSelectedShiftByDocument] = useState<Record<string, string>>({});
  const [employeeId, setEmployeeId] = useState("all");
  const [date, setDate] = useState("all");
  const [status, setStatus] = useState("all");

  const dailyDocuments = documents
    .filter((document) => document.documentType === "daily_sheet")
    .sort((a, b) => (a.documentDate ?? "").localeCompare(b.documentDate ?? ""));
  const dates = [...new Set(dailyDocuments.map((document) => document.documentDate).filter((item): item is string => Boolean(item)))].sort();

  const filteredDocuments = dailyDocuments.filter((document) => date === "all" || document.documentDate === date);
  const filteredShifts = useMemo(() => localShifts.filter((shift) => {
    if (employeeId !== "all" && shift.employeeId !== employeeId) return false;
    if (date !== "all" && shift.date !== date) return false;
    if (status !== "all" && shift.status !== status) return false;
    return true;
  }), [date, employeeId, localShifts, status]);

  async function confirmRow(shift: ShiftInput) {
    setRowErrors((current) => ({ ...current, [shift.id]: "" }));
    const response = await fetch("/api/shifts/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weekId, shiftId: shift.id })
    });
    const result = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !result.ok) {
      setRowErrors((current) => ({ ...current, [shift.id]: result.error ?? "Unable to confirm row." }));
      return;
    }
    setLocalShifts((current) => current.map((item) => item.id === shift.id ? { ...item, status: "confirmed" } : item));
  }

  function startEdit(shift: ShiftInput) {
    setEditing((current) => ({
      ...current,
      [shift.id]: {
        startTime: shift.startTime ?? "",
        finishTime: shift.finishTime ?? "",
        breakMinutes: shift.breakMinutes == null ? "" : String(shift.breakMinutes)
      }
    }));
  }

  async function saveEdit(shift: ShiftInput) {
    const draft = editing[shift.id];
    if (!draft) return;
    const breakMinutes = draft.breakMinutes.trim() === "" ? null : Number(draft.breakMinutes);
    if (breakMinutes != null && !Number.isInteger(breakMinutes)) {
      setRowErrors((current) => ({ ...current, [shift.id]: "Break must be an integer number of minutes." }));
      return;
    }
    setRowErrors((current) => ({ ...current, [shift.id]: "" }));
    const payload = {
      weekId,
      shiftId: shift.id,
      startTime: draft.startTime.trim() === "" ? null : draft.startTime.trim(),
      finishTime: draft.finishTime.trim() === "" ? null : draft.finishTime.trim(),
      breakMinutes
    };
    const response = await fetch("/api/shifts/update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json() as { ok: boolean; shiftId?: string; error?: string };
    if (!response.ok || !result.ok) {
      setRowErrors((current) => ({ ...current, [shift.id]: result.error ?? "Unable to save row." }));
      return;
    }
    setLocalShifts((current) => current.map((item) => item.id === shift.id ? {
      ...item,
      id: result.shiftId ?? item.id,
      startTime: payload.startTime,
      finishTime: payload.finishTime,
      breakMinutes: payload.breakMinutes,
      status: "uncertain"
    } : item));
    setEditing((current) => {
      const next = { ...current };
      delete next[shift.id];
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
        <label className="grid gap-1 text-sm">Employee
          <select className="rounded border p-2" onChange={(event) => setEmployeeId(event.target.value)} value={employeeId}>
            <option value="all">All employees</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Date
          <select className="rounded border p-2" onChange={(event) => setDate(event.target.value)} value={date}>
            <option value="all">Whole week</option>
            {dates.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Status
          <select className="rounded border p-2" onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="uncertain">Needs checking</option>
            <option value="manually_entered">Manually entered</option>
            <option value="extracted">Extracted</option>
          </select>
        </label>
        <div className="rounded bg-stone-100 p-3 text-sm">
          Showing {filteredShifts.length} interpreted row{filteredShifts.length === 1 ? "" : "s"}. Uncertain rows do not count in confirmed totals.
        </div>
      </div>

      {filteredDocuments.map((document) => {
        const allDocumentShifts = localShifts.filter((shift) => shift.sourceDocument === document.filename);
        const documentShifts = filteredShifts.filter((shift) => shift.sourceDocument === document.filename);
        const selectedShiftId = selectedShiftByDocument[document.filename];
        const selectedShift = documentShifts.find((shift) => shift.id === selectedShiftId) ?? documentShifts[0] ?? null;
        return (
          <article className="grid gap-4 rounded-lg border bg-white p-4 lg:grid-cols-[minmax(300px,460px)_1fr]" key={document.id}>
            <div className="space-y-2">
              <h2 className="font-semibold">{document.documentDate} paper</h2>
              <p className="break-all text-sm text-stone-600">{document.filename}</p>
              {document.qualityWarnings?.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">{document.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
               <div className="overflow-hidden rounded border bg-stone-100">
                 <img alt={document.filename} className="max-h-[760px] w-full object-contain" src={`/api/local-photo?path=${encodeURIComponent(document.path)}`} />
               </div>
               {selectedShift ? <RowMagnifier document={document} rowOrder={employees.map((employee) => employee.displayName)} shift={selectedShift} /> : null}
               <RescanDocumentButton documentId={document.id} weekId={weekId} />
               <AddMissingRowForm document={document} existingShifts={allDocumentShifts} employees={employees} weekId={weekId} />
               <a className="text-sm" href={`/api/local-photo?path=${encodeURIComponent(document.path)}`} target="_blank">Open full document</a>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">App understands these rows</h3>
              {documentShifts.length === 0 ? (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {allDocumentShifts.length === 0 ? "No rows have been extracted or entered for this paper yet." : "No matching rows for the current filters."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-100 text-stone-700">
                      <tr>
                        <th className="p-2">Employee</th>
                        <th className="p-2">Start</th>
                        <th className="p-2">Finish</th>
                        <th className="p-2">Break</th>
                        <th className="p-2">Worked</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documentShifts.map((shift) => {
                        const draft = editing[shift.id];
                        const minutes = shift.startTime && shift.finishTime && shift.breakMinutes != null ? workedMinutes(shift.startTime, shift.finishTime, shift.breakMinutes) : null;
                        return (
                          <tr className="border-t" key={shift.id}>
                            <td className="p-2 font-medium"><button className="text-left underline-offset-2 hover:underline" onClick={() => setSelectedShiftByDocument((current) => ({ ...current, [document.filename]: shift.id }))} type="button">{shift.employeeName}</button></td>
                            <td className="p-2">{draft ? <input aria-label={`${shift.employeeName} start`} className="w-20 rounded border p-1" onChange={(event) => setEditing((current) => ({ ...current, [shift.id]: { ...draft, startTime: event.target.value } }))} placeholder="HH:mm" value={draft.startTime} /> : shift.startTime ?? "Review"}</td>
                            <td className="p-2">{draft ? <input aria-label={`${shift.employeeName} finish`} className="w-20 rounded border p-1" onChange={(event) => setEditing((current) => ({ ...current, [shift.id]: { ...draft, finishTime: event.target.value } }))} placeholder="HH:mm" value={draft.finishTime} /> : shift.finishTime ?? "Review"}</td>
                            <td className="p-2">{draft ? <input aria-label={`${shift.employeeName} break`} className="w-20 rounded border p-1" onChange={(event) => setEditing((current) => ({ ...current, [shift.id]: { ...draft, breakMinutes: event.target.value } }))} placeholder="mins" value={draft.breakMinutes} /> : shift.breakMinutes ?? "Review"}</td>
                            <td className="p-2">{minutes == null ? "Review" : formatDuration(minutes)}</td>
                            <td className="p-2">
                              <div className="flex flex-col gap-2">
                              <span className={shift.status === "confirmed" ? "w-fit rounded bg-green-100 px-2 py-1 text-green-800" : "w-fit rounded bg-amber-100 px-2 py-1 text-amber-900"}>{shift.status === "uncertain" ? "needs checking" : shift.status}</span>
                              {draft ? (
                                <div className="flex flex-wrap gap-2">
                                  <button className="rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white" onClick={() => saveEdit(shift)} type="button">Save changes</button>
                                  <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setEditing((current) => { const next = { ...current }; delete next[shift.id]; return next; })} type="button">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {minutes == null ? (
                                    <button className="rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white" onClick={() => startEdit(shift)} type="button">Add missing values</button>
                                  ) : shift.status !== "confirmed" ? (
                                    <button className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white" onClick={() => confirmRow(shift)} type="button">Confirm</button>
                                  ) : null}
                                  <button className="rounded px-2 py-1.5 text-xs text-blue-700 underline-offset-2 hover:underline" onClick={() => startEdit(shift)} type="button">Edit values</button>
                                </div>
                              )}
                              {rowErrors[shift.id] ? <p className="text-xs text-red-700">{rowErrors[shift.id]}</p> : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="rounded bg-stone-50 p-3 text-sm text-stone-700">Food notes are intentionally ignored. Rows marked needs checking are visible for verification but excluded from confirmed totals.</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RescanDocumentButton({ weekId, documentId }: { weekId: string; documentId: string }) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function rescan() {
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch("/api/extraction/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekId, documentId })
      });
      const result = await response.json() as { ok: boolean; error?: string; results?: Array<{ createdRows: number; error?: string }> };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Page rescan failed.");
      const resultForDocument = result.results?.[0];
      if (resultForDocument?.error) throw new Error(resultForDocument.error);
      setMessage(`Rescanned this page and added ${resultForDocument?.createdRows ?? 0} needs-checking row(s).`);
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Page rescan failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <button className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={running} onClick={rescan} type="button">{running ? "Rescanning page..." : "Rescan this page"}</button>
      {message ? <p className="mt-1 text-xs text-amber-900">{message}</p> : null}
    </div>
  );
}

function AddMissingRowForm({ weekId, document, employees, existingShifts }: { weekId: string; document: LocalDocument; employees: EmployeeOption[]; existingShifts: ShiftInput[] }) {
  const availableEmployees = employees.filter((employee) => !existingShifts.some((shift) => shift.employeeId === employee.id));
  const [employeeId, setEmployeeId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [finishTime, setFinishTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addRow() {
    const parsedBreak = breakMinutes.trim() === "" ? null : Number(breakMinutes);
    if (parsedBreak != null && !Number.isInteger(parsedBreak)) {
      setMessage("Break must be an integer number of minutes.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/shifts/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weekId,
          documentId: document.id,
          employeeId,
          startTime: startTime.trim() || null,
          finishTime: finishTime.trim() || null,
          breakMinutes: parsedBreak
        })
      });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to add row.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add row.");
    } finally {
      setSaving(false);
    }
  }

  if (availableEmployees.length === 0) return null;
  return (
    <div className="rounded border bg-stone-50 p-3">
      <p className="font-medium">Add a missing row</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <select aria-label="Employee for missing row" className="rounded border p-2 text-sm" onChange={(event) => setEmployeeId(event.target.value)} value={employeeId}>
          <option value="">Select employee</option>
          {availableEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}
        </select>
        <input aria-label="Start time for missing row" className="rounded border p-2 text-sm" onChange={(event) => setStartTime(event.target.value)} placeholder="Start (HH:mm)" value={startTime} />
        <input aria-label="Finish time for missing row" className="rounded border p-2 text-sm" onChange={(event) => setFinishTime(event.target.value)} placeholder="Finish (HH:mm)" value={finishTime} />
        <input aria-label="Break minutes for missing row" className="rounded border p-2 text-sm" onChange={(event) => setBreakMinutes(event.target.value)} placeholder="Break (minutes)" value={breakMinutes} />
      </div>
      <button className="mt-2 rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || employeeId === ""} onClick={addRow} type="button">{saving ? "Adding row..." : "Add row"}</button>
      <p className="mt-2 text-xs text-stone-600">The row will need checking before it can be confirmed and included in totals.</p>
      {message ? <p className="mt-1 text-xs text-red-700">{message}</p> : null}
    </div>
  );
}

function RowMagnifier({ document, rowOrder, shift }: { document: LocalDocument; rowOrder: string[]; shift: ShiftInput }) {
  const cropRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [cropWidth, setCropWidth] = useState(0);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const index = rowOrder.findIndex((name) => name === shift.employeeName);
  const rowIndex = index >= 0 ? index : 10;
  const rowCenterPercent = 21 + rowIndex * 3.25;
  const imageUrl = `/api/local-photo?path=${encodeURIComponent(document.path)}`;
  const imageHeight = imageAspectRatio == null ? null : cropWidth * 1.65 * imageAspectRatio;
  const imageTop = imageHeight == null ? 0 : 112 - imageHeight * (rowCenterPercent / 100);

  useEffect(() => {
    if (!cropRef.current) return;
    const updateWidth = () => setCropWidth(cropRef.current?.clientWidth ?? 0);
    const updateImageAspectRatio = () => {
      const image = imageRef.current;
      if (image?.naturalWidth) setImageAspectRatio(image.naturalHeight / image.naturalWidth);
    };
    updateWidth();
    updateImageAspectRatio();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(cropRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="rounded border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">Row zoom: {shift.employeeName}</h3>
        <span className="rounded bg-stone-100 px-2 py-1 text-xs">approximate crop</span>
      </div>
      <div
        aria-label={`Magnified source row for ${shift.employeeName}`}
        role="img"
        className="relative h-56 overflow-hidden rounded border bg-stone-100"
        ref={cropRef}
      >
        {/* Native dimensions are needed to position the local source crop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="absolute max-w-none -translate-x-1/2"
          onLoad={(event) => setImageAspectRatio(event.currentTarget.naturalHeight / event.currentTarget.naturalWidth)}
          ref={imageRef}
          src={imageUrl}
          style={{ left: "70%", top: imageTop, width: "165%" }}
        />
      </div>
      <p className="mt-2 text-xs text-stone-600">Click a row name to move this zoom. This is a template-based helper, not a perfect OCR crop.</p>
    </div>
  );
}
