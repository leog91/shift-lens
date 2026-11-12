import { NextResponse } from "next/server";
import { isLocalDataMode } from "@/lib/data-mode";
import { prepareLocalSync } from "@/lib/local-sqlite-store";
import { localSyncConfig } from "@/lib/sync/config";
import { syncTarget } from "@/lib/sync/worker";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!isLocalDataMode()) return new NextResponse(null, { status: 404 });
  let message: string;
  try {
    const config = localSyncConfig();
    const state = config ? prepareLocalSync() : null;
    if (!config) message = "Cloud sync is not configured. All data remains local.";
    else if (!state) message = "Sync waiting for a local profile.";
    else if (state.last_error) message = `${state.last_error} Retrying automatically.`;
    else if (state.acknowledged_revision !== state.revision || state.acknowledged_target !== syncTarget(config)) message = "Verified data: pending sync. Photos and files remain local.";
    else message = `Verified data synced · ${state.last_synced_at}. Photos and files remain local.`;
  } catch { message = "Sync configuration needs attention. Local changes are saved."; }
  return NextResponse.json({ message }, { headers: { "cache-control": "no-store" } });
}
