"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { formatDuration, workedMinutes, type ShiftInput } from "@/domain/reconciliation";
import { BatchExtractionButton } from "./BatchExtractionButton";
import { belongsToDocument } from "@/lib/merge-ocr-shifts";
import { documentUrl } from "@/lib/document-url";

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

function useReviewState(weekId: string) {
  const key = `shiftlens-review-${weekId}`;
  const subscribe = (notify: () => void) => { window.addEventListener("shiftlens-review-state", notify); return () => window.removeEventListener("shiftlens-review-state", notify); };
  const snapshot = useSyncExternalStore(subscribe, () => { try { return sessionStorage.getItem(key) ?? "{}"; } catch { return "{}"; } }, () => "{}");
  let value: { employeeId?: string; date?: string; status?: string; selected?: Record<string, string> } = {};
  try { value = JSON.parse(snapshot); } catch { /* An invalid saved view must not break review. */ }
  function update(patch: Partial<typeof value>) {
    try { sessionStorage.setItem(key, JSON.stringify({ ...value, ...patch })); window.dispatchEvent(new Event("shiftlens-review-state")); } catch { /* Storage may be unavailable. */ }
  }
  useEffect(() => {
    let frame = 0;
    try { const y = Number(sessionStorage.getItem(`${key}-scroll`)); if (Number.isFinite(y)) frame = requestAnimationFrame(() => window.scrollTo(0, y)); } catch { /* Optional view state. */ }
    const save = () => { try { sessionStorage.setItem(`${key}-scroll`, String(window.scrollY)); } catch { /* Optional view state. */ } };
    window.addEventListener("scroll", save, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", save); };
  }, [key]);
  return { value, update };
}

export function ActualWeekClient({ weekId, documents, shifts, employees, readOnly = false, initialDate }: { weekId: string; documents: LocalDocument[]; shifts: ShiftInput[]; employees: EmployeeOption[]; readOnly?: boolean; initialDate?: string }) {
  const [localShifts, setLocalShifts] = useState(shifts);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, { startTime: string; finishTime: string; breakMinutes: string; correctionReason: string }>>({});
  const { value: view, update: updateView } = useReviewState(weekId);
  const selectedShiftByDocument = view.selected ?? {};
  const employeeId = view.employeeId ?? "all";
  const [calendarDate, setCalendarDate] = useState(initialDate);
  const date = calendarDate ?? view.date ?? "all";
  const status = view.status ?? "all";
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const pendingRef = useRef(new Set<string>());
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);
  const rescanDisabled = scanning || Object.values(pending).some(Boolean) || Object.keys(editing).length > 0;

  const dailyDocuments = documents
    .filter((document) => document.documentType === "daily_sheet")
    .sort((a, b) => (a.documentDate ?? "").localeCompare(b.documentDate ?? ""));
  const dates = [...new Set([...dailyDocuments.map((document) => document.documentDate).filter((item): item is string => Boolean(item)), ...localShifts.map((shift) => shift.date)])].sort();

  const filteredDocuments = dailyDocuments.filter((document) => date === "all" || document.documentDate === date);
  const filteredShifts = useMemo(() => localShifts.filter((shift) => {
    if (status !== "dismissed" && shift.status === "dismissed") return false;
    if (employeeId !== "all" && shift.employeeId !== employeeId) return false;
    if (date !== "all" && shift.date !== date) return false;
    if (status !== "all" && shift.status !== status) return false;
    return true;
  }), [date, employeeId, localShifts, status]);

  async function mutateRow(shiftId: string, action: string, data: Record<string, unknown> = {}) {
    if (pendingRef.current.has(shiftId) || scanningRef.current) return false;
    pendingRef.current.add(shiftId);
    setPending((current) => ({ ...current, [shiftId]: true }));
    setRowErrors((current) => ({ ...current, [shiftId]: "" }));
    try {
      const response = await fetch(`/api/shifts/${action}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekId, shiftId, ...data })
      });
      const result = await response.json() as { ok: boolean; error?: string; shift?: ShiftInput };
      if (!response.ok || !result.ok || !result.shift) throw new Error(result.error ?? "Unable to save row. Please retry.");
      const saved = result.shift;
      setLocalShifts((current) => current.map((item) => item.id === shiftId ? saved : item));
      return true;
    } catch (error) {
      setRowErrors((current) => ({ ...current, [shiftId]: error instanceof Error ? error.message : "Unable to save row. Please retry." }));
      return false;
    } finally {
      pendingRef.current.delete(shiftId);
      setPending((current) => ({ ...current, [shiftId]: false }));
    }
  }

  async function confirmRow(shift: ShiftInput) { await mutateRow(shift.id, "confirm"); }
  async function reviewShift(shiftId: string, action: "restore" | "not_worked" | "incorrect_ocr_row") {
    await mutateRow(shiftId, action === "restore" ? "restore" : "dismiss", action === "restore" ? {} : { reason: action });
  }
  function setScanRunning(running: boolean) { scanningRef.current = running; setScanning(running); }

  function startEdit(shift: ShiftInput) {
    setEditing((current) => ({
      ...current,
      [shift.id]: {
        correctionReason: "",
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
    const saved = await mutateRow(shift.id, "update", {
      startTime: draft.startTime.trim() || null,
      finishTime: draft.finishTime.trim() || null,
      breakMinutes,
      correctionReason: draft.correctionReason
    });
    if (!saved) return;
    setEditing((current) => {
      const next = { ...current };
      delete next[shift.id];
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {!readOnly ? <BatchExtractionButton weekId={weekId} dailySheetCount={dailyDocuments.length} unprocessedDocuments={dailyDocuments.filter((doc) => !localShifts.some((shift) => belongsToDocument(shift, doc))).length} reviewOnlyDocuments={dailyDocuments.filter((doc) => localShifts.some((shift) => belongsToDocument(shift, doc) && shift.status === "uncertain" && shift.id.startsWith("ocr-"))).length} disabled={rescanDisabled} onRunning={setScanRunning} onUpdated={setLocalShifts} /> : null}
      {Object.keys(editing).length ? <p className="text-sm text-stone-600">Save or cancel drafts before rescanning. Editing confirmed values removes them from totals until confirmed again.</p> : null}
      <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
        <label className="grid gap-1 text-sm">Employee
          <select className="rounded border p-2" onChange={(event) => updateView({ employeeId: event.target.value })} value={employeeId}>
            <option value="all">All employees</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Date
          <select className="rounded border p-2" onChange={(event) => { setCalendarDate(undefined); updateView({ date: event.target.value }); }} value={date}>
            <option value="all">Whole week</option>
            {dates.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Status
          <select className="rounded border p-2" onChange={(event) => updateView({ status: event.target.value })} value={status}>
            <option value="all">Active rows</option>
            <option value="confirmed">Confirmed</option>
            <option value="uncertain">Needs checking</option>
            <option value="manually_entered">Manually entered</option>
           <option value="extracted">Extracted</option>
           <option value="dismissed">Dismissed</option>
          </select>
        </label>
        <div className="rounded bg-stone-100 p-3 text-sm">
          Showing {filteredShifts.length} interpreted row{filteredShifts.length === 1 ? "" : "s"}. Uncertain rows do not count in confirmed totals.
        </div>
      </div>

      {date !== "all" && filteredDocuments.length === 0 && <section className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="font-semibold">{date} — no daily sheet attached</h2>
        <p className="text-sm text-amber-800">The recorded hours below cannot be checked against a paper yet. <a className="underline" href={`/weeks/${weekId}/documents`}>Open documents to check or add the missing sheet.</a></p>
        <div className="overflow-x-auto"><table className="hours-table"><thead><tr><th>Employee</th><th>Start</th><th>Finish</th><th>Break</th><th>Status</th></tr></thead><tbody>{filteredShifts.map((shift) => <tr key={shift.id}><td data-label="Employee">{shift.employeeName}</td><td data-label="Start">{shift.startTime ?? "Review"}</td><td data-label="Finish">{shift.finishTime ?? "Review"}</td><td data-label="Break">{shift.breakMinutes == null ? "Review" : `${shift.breakMinutes} min`}</td><td data-label="Status">{shift.status}</td></tr>)}</tbody></table></div>
      </section>}
      {filteredDocuments.map((document) => {
         const allDocumentShifts = localShifts.filter((shift) => belongsToDocument(shift, document));
        const documentShifts = filteredShifts.filter((shift) => belongsToDocument(shift, document));
        const selectedShiftId = selectedShiftByDocument[document.id];
        const selectedShift = documentShifts.find((shift) => shift.id === selectedShiftId) ?? documentShifts[0] ?? null;
        return (
          <article className="grid gap-4 rounded-lg border bg-white p-4 lg:grid-cols-[minmax(300px,460px)_1fr]" key={document.id}>
            <div className="space-y-2">
              <h2 className="font-semibold">{document.documentDate} paper</h2>
              <p className="break-all text-sm text-stone-600">{document.filename}</p>
              {document.qualityWarnings?.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">{document.qualityWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
               <div className="overflow-hidden rounded border bg-stone-100">
                  <img alt={document.filename} className="max-h-[760px] w-full object-contain" src={documentUrl(document.path)} />
               </div>
               {selectedShift ? <RowMagnifier document={document} shift={selectedShift} /> : null}
                {!readOnly ? <BatchExtractionButton documentId={document.id} weekId={weekId} dailySheetCount={1} unprocessedDocuments={0} reviewOnlyDocuments={0} disabled={rescanDisabled} onRunning={setScanRunning} onUpdated={setLocalShifts} /> : null}
                {!readOnly ? <AddMissingRowForm disabled={scanning} onSaving={(saving) => setPending((current) => ({ ...current, [document.id]: saving }))} document={document} existingShifts={allDocumentShifts} employees={employees} weekId={weekId} onAdded={(shift) => setLocalShifts((current) => [...current, shift])} /> : null}
                <a className="text-sm" href={documentUrl(document.path)} target="_blank">Open full document</a>
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
                            <td className="p-2 font-medium"><button className="text-left underline-offset-2 hover:underline" onClick={() => updateView({ selected: { ...selectedShiftByDocument, [document.id]: shift.id } })} type="button">{shift.employeeName}</button></td>
                            <td className="p-2">{draft ? <input disabled={pending[shift.id] || scanning} aria-label={`${shift.employeeName} start`} className="w-20 rounded border p-1" onChange={(event) => setEditing((current) => ({ ...current, [shift.id]: { ...draft, startTime: event.target.value } }))} placeholder="HH:mm" value={draft.startTime} /> : shift.startTime ?? "Review"}</td>
                            <td className="p-2">{draft ? <input disabled={pending[shift.id] || scanning} aria-label={`${shift.employeeName} finish`} className="w-20 rounded border p-1" onChange={(event) => setEditing((current) => ({ ...current, [shift.id]: { ...draft, finishTime: event.target.value } }))} placeholder="HH:mm" value={draft.finishTime} /> : shift.finishTime ?? "Review"}</td>
                            <td className="p-2">{draft ? <input disabled={pending[shift.id] || scanning} aria-label={`${shift.employeeName} break`} className="w-20 rounded border p-1" onChange={(event) => setEditing((current) => ({ ...current, [shift.id]: { ...draft, breakMinutes: event.target.value } }))} placeholder="mins" value={draft.breakMinutes} /> : shift.breakMinutes ?? "Review"}</td>
                            <td className="p-2">{minutes == null ? "Review" : formatDuration(minutes)}</td>
                            <td className="p-2">
                              <fieldset disabled={pending[shift.id] || scanning} className="flex flex-col gap-2">
                              <span className={shift.status === "confirmed" ? "w-fit rounded bg-green-100 px-2 py-1 text-green-800" : "w-fit rounded bg-amber-100 px-2 py-1 text-amber-900"}>{shift.status === "uncertain" ? "needs checking" : shift.status}</span>
                               {!readOnly && draft ? (
                                <div className="flex flex-wrap gap-2">
                                  <label className="grid gap-1 text-xs">Correction reason<input aria-label={`${shift.employeeName} correction reason`} className="rounded border p-1" value={draft.correctionReason} onChange={(event) => setEditing((current) => ({ ...current, [shift.id]: { ...draft, correctionReason: event.target.value } }))} /></label>
                                  <button className="rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white" onClick={() => saveEdit(shift)} type="button">{pending[shift.id] ? "Saving..." : "Save changes"}</button>
                                  <button className="rounded border px-3 py-1.5 text-xs" onClick={() => setEditing((current) => { const next = { ...current }; delete next[shift.id]; return next; })} type="button">Cancel</button>
                                </div>
                               ) : !readOnly ? (
                                <div className="flex flex-wrap gap-1">
                                  {minutes == null && shift.status !== "dismissed" ? (
                                    <button className="rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white" onClick={() => startEdit(shift)} type="button">Add missing values</button>
                                   ) : shift.status !== "confirmed" && shift.status !== "dismissed" ? (
                                     <button className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50" disabled={pending[shift.id]} onClick={() => confirmRow(shift)} type="button">{pending[shift.id] ? "Saving..." : "Confirm"}</button>
                                   ) : null}
                                   {shift.status === "dismissed" ? <button className="rounded border px-2 py-1.5 text-xs" onClick={() => reviewShift(shift.id, "restore")} type="button">Restore to review</button> : shift.status !== "confirmed" && shift.status !== "manually_entered" ? <>
                                     <button className="rounded px-2 py-1.5 text-xs text-amber-800" onClick={() => reviewShift(shift.id, "not_worked")} type="button">Dismiss: not worked</button>
                                     <button className="rounded px-2 py-1.5 text-xs text-amber-800" onClick={() => reviewShift(shift.id, "incorrect_ocr_row")} type="button">Dismiss: incorrect OCR</button>
                                   </> : null}
                                  {shift.status !== "dismissed" ? <button className="rounded px-2 py-1.5 text-xs text-blue-700 underline-offset-2 hover:underline" onClick={() => startEdit(shift)} type="button">Edit values</button> : null}
                                </div>
                               ) : null}
                              {rowErrors[shift.id] ? <p className="text-xs text-red-700">{rowErrors[shift.id]}</p> : null}
                              <ShiftHistory shift={shift} />
                              </fieldset>
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

function AddMissingRowForm({ weekId, document, employees, existingShifts, onAdded, disabled, onSaving }: { weekId: string; document: LocalDocument; employees: EmployeeOption[]; existingShifts: ShiftInput[]; onAdded: (shift: ShiftInput) => void; disabled: boolean; onSaving: (saving: boolean) => void }) {
  const availableEmployees = employees.filter((employee) => !existingShifts.some((shift) => shift.employeeId === employee.id && shift.status !== "dismissed"));
  const [employeeId, setEmployeeId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [finishTime, setFinishTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const savingRef = useRef(false);
  async function addRow() {
    if (disabled || savingRef.current) return;
    const parsedBreak = breakMinutes.trim() === "" ? null : Number(breakMinutes);
    if (parsedBreak != null && !Number.isInteger(parsedBreak)) {
      setMessage("Break must be an integer number of minutes.");
      return;
    }
    savingRef.current = true;
    onSaving(true);
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
      const result = await response.json() as { ok: boolean; error?: string; shift?: ShiftInput };
      if (!response.ok || !result.ok || !result.shift) throw new Error(result.error ?? "Unable to add row.");
      onAdded(result.shift);
      setEmployeeId("");
      setStartTime("");
      setFinishTime("");
      setBreakMinutes("");
      setMessage("Row added. Check its values before confirming; current filters may hide it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add row.");
    } finally {
      savingRef.current = false;
      onSaving(false);
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
      <button className="mt-2 rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || saving || employeeId === ""} onClick={addRow} type="button">{saving ? "Adding row..." : "Add row"}</button>
      <p className="mt-2 text-xs text-stone-600">The row will need checking before it can be confirmed and included in totals.</p>
      {message ? <p className="mt-1 text-xs text-red-700">{message}</p> : null}
    </div>
  );
}

function ShiftHistory({ shift }: { shift: ShiftInput }) {
  return <details className="text-xs"><summary className="cursor-pointer">Source and review history</summary>
    {shift.extraction ? <p className="mt-2">Original OCR: {shift.extraction.rawEmployeeName ?? "Unknown"}; start {shift.extraction.rawStartTime ?? "blank"}; finish {shift.extraction.rawFinishTime ?? "blank"}; break {shift.extraction.rawBreak ?? "blank"}. {shift.extraction.providerName}, {shift.extraction.extractedAt}</p> : <p>No original OCR provenance was recorded.</p>}
    {shift.uncertainFields?.length ? <p>Needs checking: {shift.uncertainFields.join(", ")}</p> : null}
    {shift.corrections?.map((entry, index) => <p className="mt-2" key={`correction-${index}`}>{entry.timestamp}: {entry.reason}. {JSON.stringify(entry.previousValue)} → {JSON.stringify(entry.newValue)}</p>)}
    {shift.reviewHistory?.map((entry, index) => <p className="mt-2" key={`review-${index}`}>{entry.timestamp}: {entry.action} — {entry.reason.replaceAll("_", " ")}</p>)}
    {shift.dismissal ? <p>Dismissed: {shift.dismissal.reason.replaceAll("_", " ")} ({shift.dismissal.timestamp})</p> : null}
  </details>;
}

function RowMagnifier({ document, shift }: { document: LocalDocument; shift: ShiftInput }) {
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const image = imageRef.current;
      if (image?.complete && image.naturalWidth) setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    });
    return () => cancelAnimationFrame(frame);
  }, [document.path]);
  const boxes = Object.entries(shift.extraction?.coordinates ?? {}).filter(([, box]) => box && imageSize && shift.extraction?.imageWidth === imageSize.width && shift.extraction?.imageHeight === imageSize.height && box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 && box.x + box.width <= imageSize.width && box.y + box.height <= imageSize.height);
  return <div className="rounded border bg-white p-3">
    <h3 className="font-semibold">Row zoom: {shift.employeeName}</h3>
    <p className="text-xs text-stone-600">{boxes.length ? "Highlighted OCR source cells — verify against the paper." : "Full photo fallback — reliable source coordinates are unavailable."}</p>
    <div className="relative w-full" role="img" aria-label={`Magnified source row for ${shift.employeeName}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imageRef} alt="" className="block h-auto w-full" src={documentUrl(document.path)} onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
      {imageSize ? boxes.map(([field, box]) => box ? <span key={field} data-source-field={field} aria-hidden="true" className="pointer-events-none absolute border-2 border-blue-600 bg-blue-100/20" style={{ left: `${box.x / imageSize.width * 100}%`, top: `${box.y / imageSize.height * 100}%`, width: `${box.width / imageSize.width * 100}%`, height: `${box.height / imageSize.height * 100}%` }} /> : null) : null}
    </div>
  </div>;
}
