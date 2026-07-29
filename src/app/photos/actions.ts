"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { z } from "zod";
import { applyPhotoDocumentAssignment } from "@/lib/photo-actions";
import { readLocalExtraWeeks, readLocalWeek, writeLocalExtraWeeks, writeLocalWeek } from "@/lib/local-week-store";
import { manualReviewPhotoRoot } from "@/lib/photo-inbox";
import { organizeAssignedPhotos } from "@/lib/photo-organizer";
import { localProfilePath } from "@/lib/local-profile";
import { requireLocalDataMode } from "@/lib/data-mode";

const PhotoAssignmentSchema = z.object({
  path: z.string().min(1),
  weekStarting: z.string().min(1),
  documentType: z.enum(["daily_sheet", "roster", "payslip", "unknown"]),
  documentDate: z.string().transform((value) => value.trim() || null),
  note: z.string().transform((value) => value.trim() || null)
});

export async function assignPhoto(formData: FormData) {
  requireLocalDataMode();
  const input = PhotoAssignmentSchema.parse(Object.fromEntries(formData));
  const primaryWeek = readLocalWeek();
  const updatedWeeks = applyPhotoDocumentAssignment([primaryWeek, ...readLocalExtraWeeks()], input);
  writeLocalWeek(updatedWeeks[0]);
  writeLocalExtraWeeks(updatedWeeks.slice(1));
  revalidatePath("/photos");
  revalidatePath("/weeks");
  revalidatePath("/weeks", "layout");
}

export async function organizePhotos() {
  requireLocalDataMode();
  organizeAssignedPhotos();
  revalidatePath("/photos");
  revalidatePath("/weeks");
}

const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const maxUploadBytes = 20 * 1024 * 1024;

function inboxFilename(filename: string) {
  const extension = extname(filename).toLowerCase();
  const name = basename(filename, extension).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "photo";
  return `${name}${extension}`;
}

function availablePath(directory: string, filename: string) {
  const extension = extname(filename);
  const name = basename(filename, extension);
  let index = 1;
  let path = join(directory, filename);
  while (existsSync(path)) {
    index += 1;
    path = join(directory, `${name}-${index}${extension}`);
  }
  return path;
}

export async function uploadPhotos(formData: FormData) {
  requireLocalDataMode();
  const files = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
  const accepted = files.filter((file) => supportedImageExtensions.has(extname(file.name).toLowerCase()) && file.size <= maxUploadBytes);
  if (accepted.length === 0) redirect("/photos?uploadError=Choose+one+or+more+JPEG%2C+PNG%2C+or+WebP+images+under+20+MB.");

  const directory = localProfilePath(manualReviewPhotoRoot);
  mkdirSync(directory, { recursive: true });
  for (const file of accepted) {
    writeFileSync(availablePath(directory, inboxFilename(file.name)), Buffer.from(await file.arrayBuffer()));
  }

  revalidatePath("/photos");
  redirect(`/photos?uploaded=${accepted.length}${accepted.length === files.length ? "" : `&skipped=${files.length - accepted.length}`}`);
}
