import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { requireLocalDataMode } from "./data-mode";
import { backupLocalDatabase, closeLocalDatabase } from "./local-sqlite-store";
import { localProfileDirectory, localProfilePath } from "./local-profile";

const ManifestSchema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  reason: z.enum(["manual", "pre_restore"]),
  files: z.array(z.object({ path: z.string(), bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }))
});

type BackupManifest = z.infer<typeof ManifestSchema>;

export interface ProfileBackup {
  id: string;
  createdAt: string;
  reason: BackupManifest["reason"];
  fileCount: number;
  bytes: number;
}

function backupRoot() {
  const configured = process.env.SHIFT_LENS_BACKUP_DIR?.trim();
  if (configured) return resolve(process.cwd(), configured);
  const profile = localProfileDirectory();
  return join(dirname(profile), "shiftlens-backups", basename(profile));
}

export function profileBackupLocation() {
  return backupRoot();
}

function backupPath(id: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9-]+$/.test(id)) throw new Error("Invalid backup identifier.");
  return join(backupRoot(), id);
}

function filesIn(directory: string, root = directory): Array<{ path: string; bytes: number; sha256: string }> {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(fullPath, root);
    if (!entry.isFile()) return [];
    const contents = readFileSync(fullPath);
    return [{ path: relative(root, fullPath), bytes: contents.length, sha256: createHash("sha256").update(contents).digest("hex") }];
  });
}

function writeManifest(directory: string, reason: BackupManifest["reason"]) {
  const files = filesIn(directory).sort((a, b) => a.path.localeCompare(b.path));
  const manifest: BackupManifest = { version: 1, createdAt: new Date().toISOString(), reason, files };
  writeFileSync(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function readManifest(directory: string) {
  const manifest = ManifestSchema.parse(JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")));
  const actualFiles = filesIn(directory).filter((file) => file.path !== "manifest.json").sort((a, b) => a.path.localeCompare(b.path));
  if (actualFiles.length !== manifest.files.length) throw new Error("Backup file list does not match its manifest.");
  for (const file of manifest.files) {
    const path = resolve(directory, file.path);
    if (!path.startsWith(`${directory}${sep}`) || !existsSync(path)) throw new Error(`Backup is missing ${file.path}.`);
    const contents = readFileSync(path);
    if (contents.length !== file.bytes || createHash("sha256").update(contents).digest("hex") !== file.sha256) throw new Error(`Backup verification failed for ${file.path}.`);
  }
  if (actualFiles.some((file, index) => file.path !== manifest.files[index]?.path)) throw new Error("Backup file list does not match its manifest.");
  if (!manifest.files.some((file) => file.path === "data/shiftlens.sqlite")) throw new Error("Backup does not contain a SQLite database.");
  return manifest;
}

export function listProfileBackups(): ProfileBackup[] {
  requireLocalDataMode();
  const root = backupRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    try {
      const manifest = ManifestSchema.parse(JSON.parse(readFileSync(join(root, entry.name, "manifest.json"), "utf8")));
      return [{ id: entry.name, createdAt: manifest.createdAt, reason: manifest.reason, fileCount: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0) }];
    } catch {
      return [];
    }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createProfileBackup(reason: BackupManifest["reason"] = "manual") {
  requireLocalDataMode();
  const id = `${new Date().toISOString().replace(/:/g, "-").replace(/\./g, "-")}-${randomUUID()}`;
  const root = backupRoot();
  const temporary = join(root, `.creating-${randomUUID()}`);
  const destination = backupPath(id);
  mkdirSync(join(temporary, "data"), { recursive: true });
  try {
    const dataDirectory = localProfilePath("data");
    if (existsSync(dataDirectory)) cpSync(dataDirectory, join(temporary, "data"), { recursive: true });
    rmSync(join(temporary, "data", "shiftlens.sqlite"), { force: true });
    rmSync(join(temporary, "data", "shiftlens.sqlite-wal"), { force: true });
    rmSync(join(temporary, "data", "shiftlens.sqlite-shm"), { force: true });
    await backupLocalDatabase(join(temporary, "data", "shiftlens.sqlite"));
    const photos = localProfilePath("photo-inbox");
    if (existsSync(photos)) cpSync(photos, join(temporary, "photo-inbox"), { recursive: true });
    const legacyProfile = localProfilePath("profile.json");
    if (existsSync(legacyProfile)) cpSync(legacyProfile, join(temporary, "profile.json"));
    writeManifest(temporary, reason);
    mkdirSync(root, { recursive: true });
    renameSync(temporary, destination);
    return { id, ...readManifest(destination) };
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

export async function restoreProfileBackup(id: string) {
  requireLocalDataMode();
  const source = backupPath(id);
  if (!existsSync(source)) throw new Error("Backup was not found.");
  readManifest(source);
  const safetyBackup = await createProfileBackup("pre_restore");
  const profile = localProfileDirectory();
  const temporary = join(dirname(profile), `.${basename(profile)}-restore-${randomUUID()}`);
  const oldData = join(profile, `.data-before-restore-${randomUUID()}`);
  const oldPhotos = join(profile, `.photos-before-restore-${randomUUID()}`);
  const oldProfile = join(profile, `.profile-before-restore-${randomUUID()}.json`);
  let dataReplaced = false;
  let photosReplaced = false;
  let profileReplaced = false;
  mkdirSync(temporary, { recursive: true });
  try {
    cpSync(join(source, "data"), join(temporary, "data"), { recursive: true });
    if (existsSync(join(source, "photo-inbox"))) cpSync(join(source, "photo-inbox"), join(temporary, "photo-inbox"), { recursive: true });
    else mkdirSync(join(temporary, "photo-inbox"));
    if (existsSync(join(source, "profile.json"))) cpSync(join(source, "profile.json"), join(temporary, "profile.json"));
    // The restore replaces the database file, so no handle may outlive the swap.
    closeLocalDatabase();
    renameSync(localProfilePath("data"), oldData);
    renameSync(localProfilePath("photo-inbox"), oldPhotos);
    if (existsSync(localProfilePath("profile.json"))) renameSync(localProfilePath("profile.json"), oldProfile);
    renameSync(join(temporary, "data"), localProfilePath("data"));
    dataReplaced = true;
    renameSync(join(temporary, "photo-inbox"), localProfilePath("photo-inbox"));
    photosReplaced = true;
    if (existsSync(join(temporary, "profile.json"))) {
      renameSync(join(temporary, "profile.json"), localProfilePath("profile.json"));
      profileReplaced = true;
    }
    rmSync(oldData, { recursive: true, force: true });
    rmSync(oldPhotos, { recursive: true, force: true });
    rmSync(oldProfile, { force: true });
    rmSync(temporary, { recursive: true, force: true });
    return safetyBackup.id;
  } catch (error) {
    if (existsSync(oldData)) {
      if (dataReplaced) rmSync(localProfilePath("data"), { recursive: true, force: true });
      if (!existsSync(localProfilePath("data"))) renameSync(oldData, localProfilePath("data"));
    }
    if (existsSync(oldPhotos)) {
      if (photosReplaced) rmSync(localProfilePath("photo-inbox"), { recursive: true, force: true });
      if (!existsSync(localProfilePath("photo-inbox"))) renameSync(oldPhotos, localProfilePath("photo-inbox"));
    }
    if (profileReplaced) rmSync(localProfilePath("profile.json"), { force: true });
    if (existsSync(oldProfile) && !existsSync(localProfilePath("profile.json"))) renameSync(oldProfile, localProfilePath("profile.json"));
    rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}
