import { createHash } from "node:crypto";
import { isLocalDataMode } from "../data-mode";
import { prepareLocalSync, recordLocalSyncResult } from "../local-sqlite-store";
import { localSyncConfig } from "./config";

export function syncTarget(config: { url: string; sourceId: string }) {
  return createHash("sha256").update(`${config.url}\n${config.sourceId}`).digest("hex");
}

export async function syncVerifiedData(fetcher: typeof fetch = fetch) {
  if (!isLocalDataMode()) return;
  const config = localSyncConfig();
  if (!config) return;
  const state = prepareLocalSync();
  if (!state) return;
  const target = syncTarget(config);
  if (state.acknowledged_revision === state.revision && state.acknowledged_target === target) return;
  try {
    const response = await fetcher(config.url, {
      method: "POST", headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify({ sourceId: config.sourceId, revision: state.revision, snapshot: JSON.parse(state.payload_json) }),
      signal: AbortSignal.timeout(20_000), redirect: "error", cache: "no-store"
    });
    if (!response.ok) throw new Error(`Sync failed (HTTP ${response.status}).`);
    const result = await response.json() as { revision?: number };
    if (result.revision !== state.revision) throw new Error("Sync returned an unexpected revision.");
    recordLocalSyncResult(state.revision, target, null);
  } catch (error) {
    // Do not persist response bodies, tokens, URLs, or document details in status messages.
    const message = error instanceof Error && /^Sync (failed \(HTTP \d+\)\.|returned an unexpected revision\.)$/.test(error.message)
      ? error.message : "Sync failed. Check connectivity and configuration; automatic retry is pending.";
    recordLocalSyncResult(state.revision, target, message);
  }
}

const runtime = globalThis as typeof globalThis & { shiftLensSyncTimer?: ReturnType<typeof setInterval> };
export function startVerifiedSyncWorker() {
  if (!isLocalDataMode() || !process.env.SHIFT_LENS_SYNC_URL || runtime.shiftLensSyncTimer) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await syncVerifiedData(); }
    catch { console.error("ShiftLens sync could not start. Check the sync configuration and local database."); }
    finally { running = false; }
  };
  runtime.shiftLensSyncTimer = setInterval(() => void tick(), 15_000);
  runtime.shiftLensSyncTimer.unref();
  void tick();
}
