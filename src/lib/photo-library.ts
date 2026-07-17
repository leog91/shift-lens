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

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return imageExtensions.has(extname(entry).toLowerCase()) ? [full] : [];
  });
}

export function getPhotoLibrary() {
  if (!isLocalDataMode()) return { files: [], duplicateGroups: [] };
  const root = localProfilePath(photoInboxRoot);
  const week = getWeekData();
  const weeks = getAllWeekData();
  const assigned = new Map(weeks.flatMap((item) => item.documents.map((document) => [document.path, { document, week: item }] as const)));
  const photoAssignments = new Map(weeks.flatMap((item) => item.photoAssignments.map((assignment) => [assignment.path, { assignment, week: item }] as const)));
  const files: PhotoFile[] = walk(root).sort().map((fullPath) => {
    const path = relative(localProfileDirectory(), fullPath);
    const assignedDocument = assigned.get(path) ?? null;
    const document = assignedDocument?.document ?? null;
    const assignedPhoto = photoAssignments.get(path) ?? null;
    const assignment = assignedPhoto?.assignment ?? null;
    return {
      path,
      filename: fullPath.split("/").pop() ?? path,
      folder: relative(root, fullPath).split("/").slice(0, -1).join("/") || "inbox",
      sizeBytes: statSync(fullPath).size,
      sha256: createHash("sha256").update(readFileSync(fullPath)).digest("hex"),
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
