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
  const updated = page.locator('[aria-label="Data last updated"]');
  await expect(updated).toContainText("Last updated:");
  await expect(updated.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
  await expect(updated.locator("time")).toContainText("UTC");
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

test("private views support rankings, employee history, daily hours, and paid breakdowns", async ({ page, request }) => {
  test.setTimeout(60_000);
  const entry = (id: string, employeeId: string, date: string, workedMinutes: number) => ({ id, employeeId, employeeName: employeeId === "alex" ? "Fictional Alex" : "Fictional Casey", date, workedMinutes });
  const payload = {
    sourceId: "11111111-1111-4111-8111-111111111111", revision: 3,
    snapshot: { version: 1, weeks: [
      { id: "june-week", weekStarting: "2026-06-29", shifts: [entry("a", "alex", "2026-06-30", 120), entry("b", "alex", "2026-06-30", 60), entry("c", "casey", "2026-07-01", 180)], payroll: [{ employeeId: "alex", employeeName: "Fictional Alex", ordinaryPaidMinutes: 120, sundayPaidMinutes: 30, otherPaidMinutes: 0, totalPaidMinutes: 150 }] },
      { id: "july-week", weekStarting: "2026-07-06", shifts: [entry("d", "alex", "2026-07-06", 60)], payroll: [] },
      { id: "empty-week", weekStarting: "2026-07-13", shifts: [], payroll: [] }
    ] }
  };
  const headers = { authorization: "Bearer fictional-sync-secret-at-least-32-characters" };
  expect((await request.post("/api/sync", { data: payload, headers })).status()).toBe(200);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("fictional-owner-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Week starting 2026-07-06", exact: true })).toBeVisible();
  const sections = page.getByRole("navigation", { name: "Private dashboard sections" });
  await sections.getByRole("link", { name: "Hours", exact: true }).click();
  await page.getByRole("combobox", { name: "Period", exact: true }).selectOption("total");
  await page.getByRole("button", { name: "Apply filters" }).click();
  const ranking = page.getByRole("table", { name: "Hours by employee", exact: true });
  await expect(ranking.getByRole("row").filter({ hasText: "Fictional Alex" })).toContainText("4h");
  await expect(ranking.getByRole("row").filter({ hasText: "Fictional Casey" })).toContainText("#2");
  await page.getByRole("combobox", { name: "Employee", exact: true }).selectOption("casey");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(ranking.getByRole("row").filter({ hasText: "Fictional Casey" })).toContainText("#2");
  await expect(ranking.getByRole("row")).toHaveCount(2);

  await page.goto("/dashboard?view=hours&period=day&key=2026-06-30");
  const dayRow = ranking.getByRole("row").filter({ hasText: "Fictional Alex" });
  await expect(dayRow.locator('[data-label="Days worked"]')).toHaveText("1");
  await expect(dayRow.locator('[data-label="Shift entries"]')).toHaveText("2");
  await expect(page.getByRole("table", { name: "Verified shift entries" }).getByRole("row")).toHaveCount(3);
  await dayRow.getByRole("link", { name: "Fictional Alex" }).click();
  await expect(page.getByRole("heading", { name: "Fictional Alex", exact: true })).toBeVisible();
  const history = page.getByRole("table", { name: "Employee hours history" });
  await expect(history.getByRole("row").filter({ hasText: "June 2026" })).toContainText("3h");
  await expect(history.getByRole("row").filter({ hasText: "July 2026" })).toContainText("1h");
  await page.getByRole("combobox", { name: "Period", exact: true }).selectOption("year");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(history.getByRole("row").filter({ hasText: "2026" })).toContainText("4h");

  await sections.getByRole("link", { name: "Paid hours", exact: true }).click();
  await page.getByRole("combobox", { name: "Choose week", exact: true }).selectOption("june-week");
  await page.getByRole("button", { name: "Apply filters" }).click();
  const payroll = page.getByRole("table", { name: "Verified payroll by employee" });
  const alex = payroll.getByRole("row").filter({ hasText: "Fictional Alex" });
  await expect(alex.locator('[data-label="Ordinary paid"]')).toHaveText("2h");
  await expect(alex.locator('[data-label="Sunday paid"]')).toHaveText("30m");
  await expect(alex.locator('[data-label="Verified paid"]')).toHaveText("2h 30m");
  await expect(alex.locator('[data-label="Subtotal difference"]')).toHaveText("30m");
  const casey = payroll.getByRole("row").filter({ hasText: "Fictional Casey" });
  await expect(casey.locator('[data-label="Verified paid"]')).toHaveText("—");
  await expect(casey.locator('[data-label="Subtotal difference"]')).toHaveText("—");

  payload.revision = 4;
  payload.snapshot.weeks[0].shifts[0].workedMinutes = 90;
  expect((await request.post("/api/sync", { data: payload, headers })).status()).toBe(200);
  await page.getByRole("button", { name: "Refresh data" }).click();
  await expect(alex.locator('[data-label="Confirmed worked"]')).toHaveText("2h 30m");
  await expect(alex.locator('[data-label="Subtotal difference"]')).toHaveText("0m");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(payroll).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const publicResponse = await request.get("/employees");
  expect(await publicResponse.text()).not.toContain("Fictional Alex");
});
