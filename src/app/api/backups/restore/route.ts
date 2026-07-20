import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { restoreProfileBackup } from "@/lib/profile-backups";

const RestoreSchema = z.object({ backupId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const { backupId } = RestoreSchema.parse(await request.json());
    const safetyBackupId = await restoreProfileBackup(backupId);
    return NextResponse.json({ ok: true, safetyBackupId });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to restore backup." }, { status: 400 });
  }
}
