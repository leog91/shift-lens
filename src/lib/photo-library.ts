import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { getAllWeekData, getWeekData } from "./week-data";
import { photoInboxRoot } from "./photo-inbox";
import { localProfileDirectory, localProfilePath } from "./local-profile";
import { isLocalDataMode } from "./data-mode";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export interface PhotoFile {
  path: string;
  filename: string;
  folder: string;
  sizeBytes: number;
  sha256: string;
  assignedToCurrentWeek: boolean;
  assignedWeekStarting: string | null;
  documentType: string | null;
  documentDate: string | null;
  assignmentNote: string | null;
}

interface PhotoStat {
  fullPath: string;
  sizeBytes: number;
  mtimeMs: number;
}

function walk(dir: string): PhotoStat[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!entry.isFile() || !imageExtensions.has(extname(entry.name).toLowerCase())) return [];
    const stats = statSync(full);
    return [{ fullPath: full, sizeBytes: stats.size, mtimeMs: stats.mtimeMs }];
  });
}

// Hashing every original on every page render reads the whole inbox from disk.
// A file whose size and modification time are unchanged still has the same hash.
const hashCache = new Map<string, { sizeBytes: number; mtimeMs: number; sha256: string }>();

function photoHash(photo: PhotoStat) {
  const cached = hashCache.get(photo.fullPath);
  if (cached && cached.sizeBytes === photo.sizeBytes && cached.mtimeMs === photo.mtimeMs) return cached.sha256;
  const sha256 = createHash("sha256").update(readFileSync(photo.fullPath)).digest("hex");
  hashCache.set(photo.fullPath, { sizeBytes: photo.sizeBytes, mtimeMs: photo.mtimeMs, sha256 });
  return sha256;
}

export function getPhotoLibrary() {
  if (!isLocalDataMode()) return { files: [], duplicateGroups: [] };
  const root = localProfilePath(photoInboxRoot);
  const week = getWeekData();
  const weeks = getAllWeekData();
  const assigned = new Map(weeks.flatMap((item) => item.documents.map((document) => [document.path, { document, week: item }] as const)));
  const photoAssignments = new Map(weeks.flatMap((item) => item.photoAssignments.map((assignment) => [assignment.path, { assignment, week: item }] as const)));
  const photos = walk(root).sort((a, b) => a.fullPath.localeCompare(b.fullPath));
  // Organizing photos renames originals, so drop entries the inbox no longer holds.
  const present = new Set(photos.map((photo) => photo.fullPath));
  for (const cached of hashCache.keys()) if (!present.has(cached)) hashCache.delete(cached);
  const files: PhotoFile[] = photos.map((photo) => {
    const fullPath = photo.fullPath;
    const path = relative(localProfileDirectory(), fullPath);
    const assignedDocument = assigned.get(path) ?? null;
    const document = assignedDocument?.document ?? null;
    const assignedPhoto = photoAssignments.get(path) ?? null;
    const assignment = assignedPhoto?.assignment ?? null;
    return {
      path,
      filename: fullPath.split("/").pop() ?? path,
      folder: relative(root, fullPath).split("/").slice(0, -1).join("/") || "inbox",
      sizeBytes: photo.sizeBytes,
      sha256: photoHash(photo),
      assignedToCurrentWeek: assignedDocument?.week.id === week.id,
      assignedWeekStarting: assignedDocument?.week.weekStarting ?? assignedPhoto?.week.weekStarting ?? null,
      documentType: document?.documentType ?? assignment?.documentType ?? null,
      documentDate: document?.documentDate ?? assignment?.documentDate ?? null,
      assignmentNote: assignment?.note ?? null
    };
  });

  const byHash = new Map<string, PhotoFile[]>();
  for (const file of files) byHash.set(file.sha256, [...(byHash.get(file.sha256) ?? []), file]);
  const duplicateGroups = [...byHash.values()].filter((group) => group.length > 1);
  return { files, duplicateGroups };
}
