export type DataMode = "demo" | "local" | "hosted";

export function dataMode(): DataMode {
  const configured = process.env.SHIFT_LENS_DATA_MODE?.trim().toLowerCase() ?? "demo";
  if (configured === "demo" || configured === "local" || configured === "hosted") return configured;
  throw new Error(`Unsupported SHIFT_LENS_DATA_MODE "${configured}". Use "demo", "local", or "hosted".`);
}

export function isLocalDataMode() {
  return dataMode() === "local";
}

export function requireLocalDataMode() {
  if (!isLocalDataMode()) {
    throw new Error("Local data is disabled in this mode. Restart with SHIFT_LENS_DATA_MODE=local to edit a local profile.");
  }
}
