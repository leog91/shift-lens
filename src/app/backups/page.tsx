import { ProfileBackupsClient } from "@/components/ProfileBackupsClient";
import { isLocalDataMode } from "@/lib/data-mode";
import { listProfileBackups, profileBackupLocation } from "@/lib/profile-backups";

export const dynamic = "force-dynamic";

export default function BackupsPage() {
  const local = isLocalDataMode();
  const backups = local ? listProfileBackups() : [];
  return <section className="space-y-6"><div className="page-heading"><p className="eyebrow">Local profile</p><h1>Backup and restore</h1><p>Each backup includes all profile data, original photos, and legacy profile metadata. Restoring verifies file checksums and creates a safety backup first.</p></div>{local ? <p className="rounded border bg-stone-50 p-3 text-sm text-stone-700">Backups are stored locally at <code className="break-all">{profileBackupLocation()}</code>.</p> : <div className="demo-notice" role="note"><strong>Demo account</strong><span>Backups and restore are available only for local profiles.</span></div>}<ProfileBackupsClient initialBackups={backups} readOnly={!local} /></section>;
}
