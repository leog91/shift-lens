"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Backup {
  id: string;
  createdAt: string;
  reason: "manual" | "pre_restore";
  fileCount: number;
  bytes: number;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProfileBackupsClient({ initialBackups, readOnly }: { initialBackups: Backup[]; readOnly: boolean }) {
  const router = useRouter();
  const [backups, setBackups] = useState(initialBackups);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function createBackup() {
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/backups/create", { method: "POST" });
      const result = await response.json() as { ok: boolean; backup?: Backup; error?: string };
      if (!response.ok || !result.ok || !result.backup) throw new Error(result.error ?? "Unable to create backup.");
      setBackups((current) => [result.backup!, ...current]);
      setMessage("Backup created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create backup.");
    } finally {
      setCreating(false);
    }
  }

  async function restoreBackup(backup: Backup) {
    if (!window.confirm(`Restore the backup from ${new Date(backup.createdAt).toLocaleString()}? Current data will be backed up first.`)) return;
    setRestoring(backup.id);
    setMessage(null);
    try {
      const response = await fetch("/api/backups/restore", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ backupId: backup.id }) });
      const result = await response.json() as { ok: boolean; safetyBackupId?: string; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to restore backup.");
      setMessage("Restore complete. A pre-restore safety backup was created.");
      router.push("/weeks");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to restore backup.");
    } finally {
      setRestoring(null);
    }
  }

  return <div className="space-y-4">
    {!readOnly ? <button className="rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={creating} onClick={createBackup} type="button">{creating ? "Creating backup..." : "Create backup"}</button> : null}
    {message ? <p className="rounded border bg-stone-50 p-3 text-sm text-stone-700" role="status">{message}</p> : null}
    {backups.length === 0 ? <div className="empty-state">No backups have been created yet.</div> : <div className="overflow-x-auto rounded border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-stone-100"><tr><th className="p-3">Created</th><th className="p-3">Type</th><th className="p-3">Contents</th><th className="p-3">Size</th>{!readOnly ? <th className="p-3" /> : null}</tr></thead><tbody>{backups.map((backup) => <tr className="border-t" key={backup.id}><td className="p-3">{new Date(backup.createdAt).toLocaleString()}</td><td className="p-3">{backup.reason === "pre_restore" ? "Pre-restore safety copy" : "Manual"}</td><td className="p-3">{backup.fileCount} files</td><td className="p-3">{formatBytes(backup.bytes)}</td>{!readOnly ? <td className="p-3 text-right"><button className="rounded border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(restoring)} onClick={() => restoreBackup(backup)} type="button">{restoring === backup.id ? "Restoring..." : "Restore"}</button></td> : null}</tr>)}</tbody></table></div>}
  </div>;
}
