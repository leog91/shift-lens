import { expect, test } from "@playwright/test";

test("one site serves public demo and private password-protected data", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/weeks$/);
  await expect(page.getByText("Demo account: all records and documents are fictional.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();

  for (const path of ["/api/local-photo?path=private.jpg", "/api/backups/create", "/api/sync/status"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
  expect((await request.post("/api/payroll/upsert", { data: {} })).status()).toBe(404);
  expect((await request.post("/api/sync", { data: {} })).status()).toBe(401);

  expect((await request.get("/demo/weekly-payslip.svg")).status()).toBe(200);
  const payload = {
    sourceId: "11111111-1111-4111-8111-111111111111", revision: 1,
    snapshot: { version: 1, weeks: [{ id: "fictional-week", weekStarting: "2026-07-06", shifts: [{ id: "fictional-shift", employeeId: "fictional-person", employeeName: "Fictional Person", date: "2026-07-06", workedMinutes: 450 }], payroll: [{ employeeId: "fictional-person", employeeName: "Fictional Person", ordinaryPaidMinutes: 420, sundayPaidMinutes: 0, otherPaidMinutes: 0, totalPaidMinutes: 420 }] }] }
  };
  const headers = { authorization: "Bearer fictional-sync-secret-at-least-32-characters" };
  expect((await request.post("/api/sync", { data: payload, headers })).status()).toBe(200);
  // Even after private data exists on the same server, anonymous pages stay fictional.
  const publicResponse = await request.get("/hours");
  expect(await publicResponse.text()).not.toContain("Fictional Person");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to sign in" })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("fictional-owner-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Verified hours", exact: true })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Fictional Person" });
  await expect(row).toContainText("7h 30m");
  await expect(row).toContainText("7h");
  await expect(row).toContainText("30m");
  const response = await page.request.get("/dashboard");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "View demo", exact: true }).click();
  await expect(page.getByText("Demo account: all records and documents are fictional.", { exact: false })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Fictional Person");
  await page.getByRole("link", { name: "My verified hours", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Verified hours", exact: true })).toBeVisible();
  await expect(page.getByText("Demo account: all records", { exact: false })).toHaveCount(0);

  const leaking = structuredClone(payload);
  Object.assign(leaking.snapshot.weeks[0].shifts[0], { sourceDocument: "private.jpg" });
  expect((await request.post("/api/sync", { data: leaking, headers })).status()).toBe(400);
  payload.revision = 2;
  payload.snapshot.weeks[0].shifts = [];
  payload.snapshot.weeks[0].payroll = [];
  expect((await request.post("/api/sync", { data: payload, headers })).status()).toBe(200);
  await page.reload();
  await expect(page.getByText("No verified hours available for this week.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/weeks$/);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
