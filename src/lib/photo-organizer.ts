import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { readLocalExtraWeeks, readLocalWeek, writeLocalExtraWeeks, writeLocalWeek } from "./local-week-store";
import type { LocalWeek } from "./week-data";
import { isInsideDirectory, manualReviewPhotoRoot, organizedPhotoRoot, photoInboxRoot } from "./photo-inbox";
import { localProfileDirectory, localProfilePath } from "./local-profile";

const photoRoot = photoInboxRoot;
const organizedRoot = organizedPhotoRoot;
const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

interface PhotoReference {
  weekStarting: string;
  documentDate: string | null;
  documentType: string;
}

function collectReferences(weeks: LocalWeek[]) {
  const references = new Map<string, PhotoReference>();
  for (const week of weeks) {
    for (const document of week.documents) {
      references.set(document.path, {
        weekStarting: week.weekStarting,
        documentDate: document.documentDate,
        documentType: document.documentType
      });
    }
    for (const assignment of week.photoAssignments) {
      if (!references.has(assignment.path)) {
        references.set(assignment.path, {
          weekStarting: week.weekStarting,
          documentDate: assignment.documentDate,
          documentType: assignment.documentType
        });
      }
    }
  }
  return references;
}

function organisedFilename(path: string, reference: PhotoReference, index: number) {
  const extension = extname(path).toLowerCase();
  const date = reference.documentDate ?? reference.weekStarting;
  const type = reference.documentType === "unknown" ? "evidence" : reference.documentType.replace(/_/g, "-");
  const suffix = index === 1 ? "" : `--${index}`;
  return `${date}--${type}${suffix}${extension}`;
}

function manualReviewDestination(filename: string) {
  const directory = localProfilePath(manualReviewPhotoRoot);
  mkdirSync(directory, { recursive: true });
  const extension = extname(filename);
  const name = basename(filename, extension);
  let index = 1;
  let destination = join(directory, filename);
  while (existsSync(destination)) {
    index += 1;
    destination = join(directory, `${name}-${index}${extension}`);
  }
  return destination;
}

export function relinkPhotoPaths(week: LocalWeek, paths: Map<string, string>): LocalWeek {
  const filenames = new Map<string, string>();
  for (const document of week.documents) {
    const nextPath = paths.get(document.path);
    if (nextPath) filenames.set(document.filename, basename(nextPath));
  }

  return {
    ...week,
    documents: week.documents.map((document) => {
      const path = paths.get(document.path);
      return path ? { ...document, path, filename: basename(path) } : document;
    }),
    photoAssignments: week.photoAssignments.map((assignment) => ({ ...assignment, path: paths.get(assignment.path) ?? assignment.path })),
    shifts: week.shifts.map((shift) => ({ ...shift, sourceDocument: shift.sourceDocument ? filenames.get(shift.sourceDocument) ?? shift.sourceDocument : shift.sourceDocument })),
    rosterEstimates: (week.rosterEstimates ?? []).map((estimate) => ({ ...estimate, sourceDocument: estimate.sourceDocument ? filenames.get(estimate.sourceDocument) ?? estimate.sourceDocument : estimate.sourceDocument })),
    rosterAssignments: (week.rosterAssignments ?? []).map((assignment) => ({ ...assignment, sourceDocument: filenames.get(assignment.sourceDocument) ?? assignment.sourceDocument })),
    reviewItems: week.reviewItems.map((item) => ({
      ...item,
      filename: filenames.get(item.filename) ?? item.filename,
      documentPath: item.documentPath ? paths.get(item.documentPath) ?? item.documentPath : item.documentPath
    }))
  };
}

export function organizeAssignedPhotos() {
  const primary = readLocalWeek();
  const extras = readLocalExtraWeeks();
  const weeks = [primary, ...extras];
  const references = collectReferences(weeks);
  const paths = new Map<string, string>();
  const reserved = new Set<string>();

  for (const [path, reference] of [...references.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const source = resolve(localProfileDirectory(), path);
    if (!isInsideDirectory(localProfilePath(photoRoot), source) || !existsSync(source)) throw new Error(`Assigned photo was not found: ${path}`);
    const directory = localProfilePath(organizedRoot, reference.weekStarting);
    mkdirSync(directory, { recursive: true });
    let index = 1;
    let destination = join(directory, organisedFilename(path, reference, index));
    if (resolve(destination) === source) continue;
    while (existsSync(destination) || reserved.has(destination)) {
      index += 1;
      destination = join(directory, organisedFilename(path, reference, index));
    }
    reserved.add(destination);
    paths.set(path, `${organizedRoot}/${reference.weekStarting}/${basename(destination)}`);
  }

  const moved: Array<{ source: string; destination: string }> = [];
  try {
    for (const [sourcePath, destinationPath] of paths) {
      const source = resolve(localProfileDirectory(), sourcePath);
      const destination = resolve(localProfileDirectory(), destinationPath);
      renameSync(source, destination);
      moved.push({ source, destination });
    }
    // Files dropped directly into the inbox remain available for manual classification.
    const inboxDirectory = localProfilePath(photoRoot);
    const heldForReview = existsSync(inboxDirectory) ? readdirSync(inboxDirectory).filter((entry) => {
      const source = join(inboxDirectory, entry);
      return statSync(source).isFile() && supportedImageExtensions.has(extname(entry).toLowerCase()) && !references.has(`${photoRoot}/${entry}`);
    }) : [];
    for (const filename of heldForReview) {
      const source = join(inboxDirectory, filename);
      const destination = manualReviewDestination(filename);
      renameSync(source, destination);
      moved.push({ source, destination });
    }
    if (paths.size > 0) {
      const updatedWeeks = weeks.map((week) => relinkPhotoPaths(week, paths));
      writeLocalWeek(updatedWeeks[0]);
      writeLocalExtraWeeks(updatedWeeks.slice(1));
    }
  } catch (error) {
    for (const { source, destination } of moved.reverse()) {
      if (existsSync(destination) && !existsSync(source)) renameSync(destination, source);
    }
    throw error;
  }

  if (moved.length === 0) return { moved: 0, message: "All assigned originals are already organized." };
  const organized = paths.size;
  const heldForReview = moved.length - organized;
  return { moved: moved.length, message: `Organized ${organized} assigned photo(s) and kept ${heldForReview} photo(s) in manual review.` };
}
