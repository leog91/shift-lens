import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { NextRequest } from "next/server";
import { acceptSnapshot, readPublishedSnapshot } from "@/lib/hosted/snapshots";
import { hostedConfig } from "@/lib/hosted/config";
import { hostedRouteAllowed } from "@/lib/hosted/routes";
import { POST } from "@/app/api/sync/route";
import { getAllWeekData } from "@/lib/week-data";

const sourceId = "11111111-1111-4111-8111-111111111111";
const envelope = (revision = 1) => ({ sourceId, revision, snapshot: { version: 1 as const, weeks: [{ id: "fictional-week", weekStarting: "2026-07-06", shifts: [{ id: "fictional-shift", employeeId: "fictional-person", employeeName: "Fictional Person", date: "2026-07-06", workedMinutes: 450 }], payroll: [] }] } });

describe("hosted data security and revisions", () => {
  let database: Client;
  let directory: string;
  beforeEach(async () => {
    directory = mkdtempSync("/tmp/opencode/shiftlens-hosted-");
    database = createClient({ url: `file:${join(directory, "hosted.sqlite")}` });
    await database.executeMultiple(readFileSync("scripts/hosted-schema.sql", "utf8"));
  });
  afterEach(() => {
    database.close();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });
  test("idempotent retries, newer corrections, revocations, and deletions", async () => {
    await acceptSnapshot(database, "fictional-business", sourceId, envelope());
    const first = await readPublishedSnapshot(database, "fictional-business");
    await acceptSnapshot(database, "fictional-business", sourceId, envelope());
    expect((await readPublishedSnapshot(database, "fictional-business"))?.receivedAt).toBe(first?.receivedAt);
    const revoked = envelope(2);
    revoked.snapshot.weeks[0].shifts = [];
    await acceptSnapshot(database, "fictional-business", sourceId, revoked);
    expect((await readPublishedSnapshot(database, "fictional-business"))?.snapshot.weeks[0].shifts).toEqual([]);
    await acceptSnapshot(database, "fictional-business", sourceId, { ...envelope(3), snapshot: { version: 1, weeks: [] } });
    expect((await readPublishedSnapshot(database, "fictional-business"))?.snapshot.weeks).toEqual([]);
  });
  test("stale, conflicting, and different-source snapshots cannot overwrite data", async () => {
    await acceptSnapshot(database, "fictional-business", sourceId, envelope(3));
    await expect(acceptSnapshot(database, "fictional-business", sourceId, envelope(2))).rejects.toThrow("Stale");
    const conflict = envelope(3);
    conflict.snapshot.weeks[0].shifts[0].workedMinutes = 0;
    await expect(acceptSnapshot(database, "fictional-business", sourceId, conflict)).rejects.toThrow("conflicting");
    await expect(acceptSnapshot(database, "fictional-business", "22222222-2222-4222-8222-222222222222", envelope(4))).rejects.toThrow("source");
    expect((await readPublishedSnapshot(database, "fictional-business"))?.snapshot.weeks[0].shifts[0].workedMinutes).toBe(450);
  });
  test("reads are scoped to a server-selected business", async () => {
    await acceptSnapshot(database, "fictional-business", sourceId, envelope());
    expect(await readPublishedSnapshot(database, "another-business")).toBeNull();
  });
  test("hosted public pages always use fictional records, even when private snapshots exist", async () => {
    vi.stubEnv("SHIFT_LENS_DATA_MODE", "hosted");
    await acceptSnapshot(database, "fictional-business", sourceId, envelope());
    const publicData = JSON.stringify(getAllWeekData());
    expect(publicData).toContain("Alex Example");
    expect(publicData).not.toContain("Fictional Person");
  });
  test("hosted route allowlist blocks local files, OCR, backups, and edits", () => {
    for (const path of ["/api/local-photo", "/api/extraction/batch", "/api/backups/create", "/api/payroll/upsert", "/api/sync/status", "/_next/image"]) {
      expect(hostedRouteAllowed(path, "GET")).toBe(false);
      expect(hostedRouteAllowed(path, "POST")).toBe(false);
    }
    expect(hostedRouteAllowed("/dashboard", "GET")).toBe(true);
    expect(hostedRouteAllowed("/dashboard", "POST")).toBe(false);
    expect(hostedRouteAllowed("/api/sync", "POST")).toBe(true);
    expect(hostedRouteAllowed("/api/sync", "GET")).toBe(false);
    for (const path of ["/weeks", "/weeks/demo-week/actual", "/hours", "/employees", "/photos", "/demo/weekly-payslip.svg"]) {
      expect(hostedRouteAllowed(path, "GET")).toBe(true);
      expect(hostedRouteAllowed(path, "POST")).toBe(false);
    }
  });
  test("sync endpoint is disabled outside hosted mode", async () => {
    vi.stubEnv("SHIFT_LENS_DATA_MODE", "local");
    expect((await POST(new NextRequest("https://fictional.example/api/sync", { method: "POST" }))).status).toBe(404);
    expect(hostedConfig).toThrow("disabled");
  });
  test("sync authenticates before parsing any payload", async () => {
    vi.stubEnv("SHIFT_LENS_DATA_MODE", "hosted");
    vi.stubEnv("TURSO_DATABASE_URL", `file:${join(directory, "hosted.sqlite")}`);
    vi.stubEnv("BETTER_AUTH_URL", "https://fictional.example");
    vi.stubEnv("BETTER_AUTH_SECRET", "fictional-auth-secret-at-least-32-characters");
    vi.stubEnv("SHIFT_LENS_SYNC_TOKEN", "fictional-sync-secret-at-least-32-characters");
    vi.stubEnv("SHIFT_LENS_SYNC_SOURCE_ID", sourceId);
    vi.stubEnv("SHIFT_LENS_HOSTED_COMPANY_ID", "fictional-business");
    vi.stubEnv("SHIFT_LENS_HOSTED_OWNER_EMAIL", "owner@example.com");
    const request = new NextRequest("https://fictional.example/api/sync", { method: "POST", body: "invalid JSON" });
    expect((await POST(request)).status).toBe(401);
  });
});
