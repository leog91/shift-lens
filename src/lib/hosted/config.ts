import { dataMode } from "../data-mode";
import { z } from "zod";

export function hostedConfig() {
  if (dataMode() !== "hosted") throw new Error("Hosted storage is disabled in this mode.");
  const required = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}.`);
    return value;
  };
  const url = required("TURSO_DATABASE_URL");
  if (!url.startsWith("libsql://") && !(process.env.NODE_ENV !== "production" && url.startsWith("file:"))) throw new Error("Use a dedicated libsql:// Turso database.");
  const baseURL = new URL(required("BETTER_AUTH_URL"));
  if (baseURL.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(baseURL.hostname) && baseURL.protocol === "http:")) throw new Error("Hosted login requires HTTPS.");
  const secret = required("BETTER_AUTH_SECRET");
  const syncToken = required("SHIFT_LENS_SYNC_TOKEN");
  if (secret.length < 32 || syncToken.length < 32 || secret === syncToken) throw new Error("Use distinct auth and sync secrets of at least 32 characters.");
  return {
    url, authToken: url.startsWith("file:") ? undefined : required("TURSO_AUTH_TOKEN"),
    baseURL: baseURL.origin, secret, syncToken,
    companyId: z.string().min(1).max(200).parse(required("SHIFT_LENS_HOSTED_COMPANY_ID")),
    ownerEmail: z.email().parse(required("SHIFT_LENS_HOSTED_OWNER_EMAIL")).toLowerCase(),
    sourceId: z.uuid().parse(required("SHIFT_LENS_SYNC_SOURCE_ID"))
  };
}
