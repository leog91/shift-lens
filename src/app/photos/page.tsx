import { getPhotoLibrary } from "@/lib/photo-library";
import type { PhotoFile } from "@/lib/photo-library";
import { getWeekData } from "@/lib/week-data";
import { assignPhoto, organizePhotos, uploadPhotos } from "./actions";
import { isLocalDataMode } from "@/lib/data-mode";

export const dynamic = "force-dynamic";

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ uploaded?: string; skipped?: string; uploadError?: string }> }) {
  const upload = await searchParams;
  const { files, duplicateGroups } = getPhotoLibrary();
  const week = getWeekData();
  const unassigned = files.filter((file) => !file.assignedWeekStarting);
  const manualReview = files.filter((file) => file.folder === "manual-review");
  const assignedToCurrentWeek = files.filter((file) => file.assignedToCurrentWeek);
  const assignedToOtherWeeks = files.filter((file) => file.assignedWeekStarting && !file.assignedToCurrentWeek);
  const readOnly = !isLocalDataMode();

  return (
    <section className="space-y-6">
      <div className="page-heading">
        <p className="eyebrow">Evidence library</p>
        <h1>Photo inbox</h1>
        <p>Add a photo, assign its week and document details, then organize it. The work queue below always comes first.</p>
      </div>

      <div className="photo-stats">
        <div className="photo-stat"><p>Needs assignment</p><strong>{unassigned.length}</strong></div>
        <div className="photo-stat"><p>This week</p><strong>{assignedToCurrentWeek.length}</strong></div>
        <div className="photo-stat"><p>Other weeks</p><strong>{assignedToOtherWeeks.length}</strong></div>
        <div className="photo-stat"><p>Duplicate groups</p><strong>{duplicateGroups.length}</strong></div>
      </div>

      {upload.uploaded ? <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">Added {upload.uploaded} image{upload.uploaded === "1" ? "" : "s"} to the inbox.{upload.skipped ? ` Skipped ${upload.skipped} unsupported or oversized file${upload.skipped === "1" ? "" : "s"}.` : ""}</p> : null}
      {upload.uploadError ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{upload.uploadError}</p> : null}

      <section className="photo-actions">
        <div>
          <p className="eyebrow">1. Add</p>
          <h2>Add images</h2>
          <p>{readOnly ? "Demo accounts can view fictional evidence but cannot upload or process files." : "Files are copied to the review queue. JPEG, PNG, and WebP files up to 20 MB are supported."}</p>
        </div>
        <form action={uploadPhotos} className="flex flex-wrap items-center gap-2">
          <input accept="image/jpeg,image/png,image/webp" className="max-w-full text-sm" disabled={readOnly} multiple name="photos" required type="file" />
          <span title={readOnly ? "Demo account: uploads are disabled." : undefined}><button className="button-primary" disabled={readOnly} type="submit">Add to inbox</button></span>
        </form>
      </section>

      <section className="photo-queue" aria-labelledby="review-heading">
        <div className="section-title">
          <div><p className="eyebrow">2. Assign</p><h2 id="review-heading">Needs assignment</h2></div>
          <span>{unassigned.length} waiting</span>
        </div>
        {unassigned.length ? <div className="photo-grid">{unassigned.map((file) => <PhotoCard file={file} key={file.path} weekStarting={week.weekStarting} showForm />)}</div> : <p className="queue-clear">Nothing is waiting for assignment. New uploads will appear here.</p>}
        <p className="text-xs text-amber-900">Assignments update local week metadata only. They do not extract rows or change confirmed totals.</p>
        {manualReview.length ? <p className="text-xs text-amber-900">{manualReview.length} file{manualReview.length === 1 ? " is" : "s are"} in the manual-review folder.</p> : null}
      </section>

      <section className="photo-actions">
        <div>
          <p className="eyebrow">3. Organize</p>
          <h2>Move assigned photos</h2>
          <p>Assigned files move into their week folder with a clear name. Uncertain files stay in the review queue.</p>
        </div>
        <form action={organizePhotos}>
          <span title={readOnly ? "Demo account: organizing files is disabled." : undefined}><button className="button-secondary" disabled={readOnly} type="submit">Organize files</button></span>
        </form>
      </section>

      <section className="space-y-3" aria-labelledby="current-week-heading">
        <div className="section-title"><div><p className="eyebrow">Current week</p><h2 id="current-week-heading">This week&apos;s evidence</h2></div><span>{assignedToCurrentWeek.length} files</span></div>
        {assignedToCurrentWeek.length ? <div className="photo-grid">{assignedToCurrentWeek.map((file) => <PhotoCard file={file} key={file.path} weekStarting={week.weekStarting} />)}</div> : <p className="queue-clear">No evidence has been assigned to this week yet.</p>}
      </section>

      <details className="photo-details">
        <summary>Other weeks ({assignedToOtherWeeks.length})</summary>
        <div className="photo-grid pt-4">{assignedToOtherWeeks.map((file) => <PhotoCard file={file} key={file.path} weekStarting={week.weekStarting} />)}</div>
      </details>

      {duplicateGroups.length ? <details className="photo-details"><summary>Exact duplicate checks ({duplicateGroups.length})</summary><div className="space-y-3 pt-4">{duplicateGroups.map((group) => <div className="rounded border bg-white p-3" key={group[0].sha256}><p className="mb-2 text-sm text-stone-600">Same file hash: {group[0].sha256.slice(0, 16)}</p><ul className="list-disc space-y-1 pl-5 text-sm">{group.map((file) => <li className="break-all" key={file.path}>{file.path}</li>)}</ul></div>)}</div></details> : null}
    </section>
  );
}

function PhotoCard({ file, weekStarting, showForm = false }: { file: PhotoFile; weekStarting: string; showForm?: boolean }) {
  const assignment = file.assignedToCurrentWeek ? "This week" : file.assignedWeekStarting ?? "Unassigned";
  return <article className="photo-card" id={`photo-${encodeURIComponent(file.path)}`}>
    <a className="photo-preview" href={`/api/local-photo?path=${encodeURIComponent(file.path)}`} target="_blank"><img alt={file.filename} src={`/api/local-photo?path=${encodeURIComponent(file.path)}`} /></a>
    <div className="min-w-0 space-y-1 p-3"><p className="truncate font-semibold" title={file.filename}>{file.filename}</p><p className="text-xs text-stone-600">{file.documentDate ?? "No date"} · {file.documentType?.replace("_", " ") ?? "No type"}</p><span className={file.assignedWeekStarting ? "photo-status assigned" : "photo-status"}>{assignment}</span>{file.assignmentNote ? <p className="text-xs text-stone-600">{file.assignmentNote}</p> : null}</div>
    {showForm ? <PhotoAssignmentForm file={file} weekStarting={weekStarting} /> : <details className="photo-card-details"><summary>View or change assignment</summary><PhotoAssignmentForm file={file} weekStarting={weekStarting} /></details>}
  </article>;
}

function PhotoAssignmentForm({ file, weekStarting }: { file: PhotoFile; weekStarting: string }) {
  const suggestedType = /roster|schedule|rota/i.test(file.filename) ? "roster" : /payslip|payroll|wage/i.test(file.filename) ? "payslip" : "unknown";
  const selectedType = file.documentType ?? suggestedType;
  return <form action={assignPhoto} className="photo-assignment-form">
    <input name="path" type="hidden" value={file.path} />
    <label>Week starting<input defaultValue={file.assignedWeekStarting ?? weekStarting} name="weekStarting" type="date" /></label>
    <label>Document date<input defaultValue={file.documentDate ?? ""} name="documentDate" type="date" /></label>
    <label>Type<select defaultValue={selectedType} name="documentType"><option value="unknown">unknown - choose after review</option><option value="daily_sheet">daily sheet</option><option value="roster">roster</option><option value="payslip">payslip</option></select></label>
    <label>Note<input defaultValue={file.assignmentNote ?? ""} name="note" placeholder="optional" /></label>
    <button className="button-primary" type="submit">Save assignment</button>
    {file.documentType ? <p className="text-xs text-amber-900">Changing the type removes unconfirmed OCR proposals and review items from this document. Confirmed and manual entries are kept.</p> : <p className="text-xs text-stone-600">Suggested type: {suggestedType.replace("_", " ")}. Check the image and choose the final type before saving.</p>}
  </form>;
}
