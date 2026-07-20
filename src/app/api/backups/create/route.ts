import { NextResponse } from "next/server";
import { createProfileBackup } from "@/lib/profile-backups";

export async function POST() {
  try {
    const backup = await createProfileBackup();
    return NextResponse.json({ ok: true, backup: { id: backup.id, createdAt: backup.createdAt, reason: backup.reason, fileCount: backup.files.length, bytes: backup.files.reduce((sum, file) => sum + file.bytes, 0) } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to create backup." }, { status: 400 });
  }
}
