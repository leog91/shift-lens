export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SHIFT_LENS_DATA_MODE === "local" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startVerifiedSyncWorker } = await import("./lib/sync/worker");
    startVerifiedSyncWorker();
  }
}
