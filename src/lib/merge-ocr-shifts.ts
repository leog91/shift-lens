import type { ShiftInput } from "@/domain/reconciliation";

export interface SourceDocument { id: string; filename: string }
export function belongsToDocument(shift: ShiftInput, document: SourceDocument) {
  return shift.sourceDocumentId ? shift.sourceDocumentId === document.id : shift.sourceDocument === document.filename;
}

// The daily-sheet workflow has one row per employee/document. OCR row indexes
// describe geometry, not identity: they may change when a heading is detected.
export function mergeOcrShifts(current: ShiftInput[], baseline: ShiftInput[], document: SourceDocument, proposals: ShiftInput[]) {
  const disposable = (shift: ShiftInput) => shift.id.startsWith("ocr-") && shift.status === "uncertain" && !shift.corrections?.length && !shift.reviewHistory?.length && !shift.dismissal;
  const before = new Map(baseline.map((shift) => [shift.id, shift]));
  const retained = current.filter((shift) => !belongsToDocument(shift, document) || !disposable(shift) || JSON.stringify(before.get(shift.id)) !== JSON.stringify(shift));
  const occupied = new Set(retained.filter((shift) => belongsToDocument(shift, document)).map((shift) => shift.employeeId));
  const ids = new Set(retained.map((shift) => shift.id));
  for (const proposal of proposals) {
    if (occupied.has(proposal.employeeId) || ids.has(proposal.id)) continue;
    retained.push({ ...proposal, sourceDocumentId: document.id, sourceDocument: document.filename, status: "uncertain" });
    occupied.add(proposal.employeeId);
    ids.add(proposal.id);
  }
  return retained;
}
