import { z } from "zod";

export function localSyncConfig() {
  const url = process.env.SHIFT_LENS_SYNC_URL;
  if (!url) return null;
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) {
    throw new Error("Sync requires HTTPS (loopback HTTP is permitted in development only).");
  }
  if (endpoint.pathname !== "/api/sync" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("Sync URL must end in /api/sync, without credentials or query parameters.");
  const token = process.env.SHIFT_LENS_SYNC_TOKEN;
  if (!token || token.length < 32) throw new Error("SHIFT_LENS_SYNC_TOKEN must contain at least 32 characters.");
  return { url: endpoint.toString(), token, sourceId: z.uuid().parse(process.env.SHIFT_LENS_SYNC_SOURCE_ID) };
}
