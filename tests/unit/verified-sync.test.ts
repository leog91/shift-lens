import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { LocalWeek } from "@/lib/week-data";
import { projectVerifiedData, SyncEnvelopeSchema } from "@/lib/sync/projection";
import { localSyncConfig } from "@/lib/sync/config";
import { startVerifiedSyncWorker, syncVerifiedData } from "@/lib/sync/worker";
import { closeLocalDatabase, getLocalWeeks, prepareLocalSync, writeLocalWeek, writeLocalWeeks } from "@/lib/local-sqlite-store";

const sourceId = "11111111-1111-4111-8111-111111111111";
export function fictionalWeek(): LocalWeek {
  return {
    id: "fictional-week", weekStarting: "2026-07-06", status: "open",
    employees: [{ id: "fictional-person", displayName: "Fictional Person", aliases: ["PRIVATE_ALIAS"] }],
    documents: [{ id: "doc", filename: "PRIVATE_PHOTO.jpg", path: "/PRIVATE_PATH/PRIVATE_PHOTO.jpg", documentDate: "2026-07-06", documentType: "daily_sheet", qualityWarnings: ["PRIVATE_WARNING"] }],
    photoAssignments: [], reviewItems: [],
    shifts: [{ id: "confirmed", employeeId: "fictional-person", employeeName: "Fictional Person", date: "2026-07-06", startTime: "09:00", finishTime: "17:00", breakMinutes: 30, status: "confirmed", uncertainFields: [], sourceDocument: "PRIVATE_PHOTO.jpg" }],
    payroll: [{ employeeId: "fictional-person", employeeName: "Fictional Person", ordinaryPaidMinutes: 420, sundayPaidMinutes: 0, otherPaidMinutes: 0, displayedTotalPaidMinutes: null, verified: true }]
  };
}

describe("verified data privacy projection", () => {
  test("only explicit verified fields cross the boundary, calculated in integer minutes", () => {
    const week = fictionalWeek();
    week.shifts[0].id = "ocr-doc-PRIVATE_PHOTO.jpg-person";
    const projected = projectVerifiedData([week]);
    expect(projected.weeks[0].shifts[0].workedMinutes).toBe(450);
    expect(projected.weeks[0].payroll[0].totalPaidMinutes).toBe(420);
    expect(JSON.stringify(projected)).not.toContain("PRIVATE");
    expect(projected.weeks[0].shifts[0]).not.toHaveProperty("startTime");
    expect(projected.weeks[0].shifts[0].id).toMatch(/^[a-f0-9]{64}$/);
  });
  test.each(["extracted", "uncertain", "dismissed"] as const)("excludes %s shifts", status => {
    const week = fictionalWeek();
    week.shifts[0].status = status;
    expect(projectVerifiedData([week]).weeks[0].shifts).toEqual([]);
  });
  test("excludes missing, invalid and uncertain values even on confirmed rows", () => {
    const week = fictionalWeek();
    week.shifts[0].uncertainFields = ["employeeName"];
    expect(projectVerifiedData([week]).weeks[0].shifts).toEqual([]);
    week.shifts[0].uncertainFields = [];
    week.shifts[0].breakMinutes = null;
    expect(projectVerifiedData([week]).weeks[0].shifts).toEqual([]);
    week.shifts[0].breakMinutes = 999;
    expect(projectVerifiedData([week]).weeks[0].shifts).toEqual([]);
  });
  test("manual entries are verified but legacy payroll is not", () => {
    const week = fictionalWeek();
    week.shifts[0].status = "manually_entered";
    delete week.payroll[0].verified;
    const projected = projectVerifiedData([week]);
    expect(projected.weeks[0].shifts).toHaveLength(1);
    expect(projected.weeks[0].payroll).toEqual([]);
  });
  test("outstanding reviews suppress the affected data without leaking review text", () => {
    const week = fictionalWeek();
    week.reviewItems = [{ id: "review", employeeName: "Fictional Person", filename: "PRIVATE_PHOTO.jpg", reason: "PRIVATE_REASON", raw: "PRIVATE_RAW", proposed: null, reviewType: "paid_hours" }];
    expect(projectVerifiedData([week]).weeks[0].payroll).toEqual([]);
    expect(projectVerifiedData([week]).weeks[0].shifts).toHaveLength(1);
    week.reviewItems[0].reviewType = "break_minutes";
    expect(projectVerifiedData([week]).weeks[0].shifts).toEqual([]);
  });
  test("strict envelope rejects forbidden fields, including nested files and company scopes", () => {
    const envelope = { sourceId, revision: 1, snapshot: projectVerifiedData([fictionalWeek()]) };
    expect(SyncEnvelopeSchema.safeParse({ ...envelope, companyId: "other-business" }).success).toBe(false);
    expect(SyncEnvelopeSchema.safeParse({ ...envelope, snapshot: { ...envelope.snapshot, files: [] } }).success).toBe(false);
    const changed = structuredClone(envelope);
    Object.assign(changed.snapshot.weeks[0].shifts[0], { sourceDocument: "private.jpg" });
    expect(SyncEnvelopeSchema.safeParse(changed).success).toBe(false);
  });
});

describe("durable automatic sync", () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync("/tmp/opencode/shiftlens-sync-");
    mkdirSync(join(directory, "data"));
    const database = new Database(join(directory, "data", "shiftlens.sqlite"));
    database.exec("CREATE TABLE companies (id TEXT PRIMARY KEY, business_name TEXT, schema_version INTEGER); INSERT INTO companies VALUES ('fictional-company', 'Fictional Company', 3)");
    database.close();
    vi.stubEnv("SHIFT_LENS_PROFILE_DIR", directory);
    vi.stubEnv("SHIFT_LENS_DATA_MODE", "local");
    vi.stubEnv("SHIFT_LENS_SYNC_URL", "https://fictional.example.com/api/sync");
    vi.stubEnv("SHIFT_LENS_SYNC_SOURCE_ID", sourceId);
    vi.stubEnv("SHIFT_LENS_SYNC_TOKEN", "fictional-token-at-least-32-characters");
  });
  afterEach(() => {
    const runtime = globalThis as typeof globalThis & { shiftLensSyncTimer?: ReturnType<typeof setInterval> };
    if (runtime.shiftLensSyncTimer) clearInterval(runtime.shiftLensSyncTimer);
    delete runtime.shiftLensSyncTimer;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    closeLocalDatabase();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });
  test("queues edits atomically, persists across reopen, and excludes document-only edits", () => {
    const week = fictionalWeek();
    writeLocalWeek(week);
    const first = prepareLocalSync()!;
    expect(first.revision).toBe(1);
    week.documents[0].path = "PRIVATE_CHANGED";
    writeLocalWeek(week);
    expect(prepareLocalSync()!.revision).toBe(1);
    week.shifts[0].breakMinutes = 60;
    writeLocalWeek(week);
    closeLocalDatabase();
    expect(prepareLocalSync()!.revision).toBe(2);
    expect(getLocalWeeks()[0].payroll[0].verified).toBe(true);
    expect(prepareLocalSync()!.payload_json).not.toContain("PRIVATE");
  });
  test("failed sync retains local edits, retries automatically, then skips acknowledged data", async () => {
    writeLocalWeek(fictionalWeek());
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    await syncVerifiedData(offline);
    expect(prepareLocalSync()!.last_error).toContain("Sync failed");
    expect(prepareLocalSync()!.acknowledged_revision).toBe(0);
    const online = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ revision: 1 }));
    await syncVerifiedData(online);
    expect(prepareLocalSync()!.acknowledged_revision).toBe(1);
    expect(prepareLocalSync()!.last_error).toBeNull();
    await syncVerifiedData(online);
    expect(online).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(online.mock.calls[0][1]?.body));
    expect(body).not.toHaveProperty("companyId");
    expect(JSON.stringify(body)).not.toContain("PRIVATE");
  });
  test("background worker catches up on startup and syncs later edits without publishing", async () => {
    vi.useFakeTimers();
    writeLocalWeek(fictionalWeek());
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      return Response.json({ revision: JSON.parse(String(options?.body)).revision });
    });
    vi.stubGlobal("fetch", fetcher);
    startVerifiedSyncWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(prepareLocalSync()!.acknowledged_revision).toBe(1);
    const week = fictionalWeek();
    week.shifts[0].breakMinutes = 60;
    writeLocalWeek(week);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(prepareLocalSync()!.acknowledged_revision).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  test("revocation and week deletion generate replacement snapshots", () => {
    const week = fictionalWeek();
    writeLocalWeek(week);
    week.shifts[0].status = "uncertain";
    week.payroll[0].verified = false;
    writeLocalWeek(week);
    expect(JSON.parse(prepareLocalSync()!.payload_json).weeks[0]).toMatchObject({ shifts: [], payroll: [] });
    writeLocalWeeks([]);
    expect(JSON.parse(prepareLocalSync()!.payload_json).weeks).toEqual([]);
    expect(prepareLocalSync()!.revision).toBe(3);
  });
  test("an in-flight acknowledgement never loses newer edits", async () => {
    const week = fictionalWeek();
    writeLocalWeek(week);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      week.shifts[0].breakMinutes = 60;
      writeLocalWeek(week);
      return Response.json({ revision: 1 });
    });
    await syncVerifiedData(fetcher);
    expect(prepareLocalSync()).toMatchObject({ revision: 2, acknowledged_revision: 1 });
  });
  test("no network requests in demo/hosted modes or with sync disabled", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubEnv("SHIFT_LENS_DATA_MODE", "demo");
    await syncVerifiedData(fetcher);
    vi.stubEnv("SHIFT_LENS_DATA_MODE", "hosted");
    await syncVerifiedData(fetcher);
    vi.stubEnv("SHIFT_LENS_DATA_MODE", "local");
    vi.stubEnv("SHIFT_LENS_SYNC_URL", "");
    await syncVerifiedData(fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
  test("rejects insecure production destinations and missing credentials", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHIFT_LENS_SYNC_URL", "http://fictional.example.com/api/sync");
    expect(localSyncConfig).toThrow("HTTPS");
    vi.stubEnv("SHIFT_LENS_SYNC_URL", "https://fictional.example.com/api/sync");
    vi.stubEnv("SHIFT_LENS_SYNC_TOKEN", "short");
    expect(localSyncConfig).toThrow("32");
  });
});
