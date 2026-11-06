import { test, expect } from "@playwright/test";

test("workflow 1 opens a fictional week and sees review status", async ({ page }) => {
  await page.goto("/weeks");
  await expect(page.getByText("Demo account: all records and documents are fictional. Editing and local file processing are disabled.")).toBeVisible();
  await expect(page.getByText("Week starting 2026-06-29")).toBeVisible();
  await page.goto("/weeks/demo-week-28/comparison");
  await expect(page.getByText("needs_review").first()).toBeVisible();
});

test("workflow 2 demo payroll shows paid total", async ({ page }) => {
  await page.goto("/weeks/demo-week-27/review");
  await expect(page.getByText("Review queue is clear.")).toBeVisible();
  await page.goto("/weeks/demo-week-27/payroll");
  await expect(page.getByText("Ordinary").first()).toBeVisible();
  await expect(page.getByText("7h 30m")).toBeVisible();
});

test("workflow 3 fictional documents are listed without local photos", async ({ page }) => {
  await page.goto("/weeks/demo-week-28/documents");
  await expect(page.getByText("demo-weekly-payslip.svg")).toBeVisible();
  await expect(page.getByAltText("demo-weekly-payslip.svg")).toBeVisible();
  await expect(page.getByText("Uploading and processing documents is disabled.")).toBeVisible();
});

test("workflow 4 confirmed hours can be shown as a weekly summary", async ({ page }) => {
  await page.goto("/weeks/demo-week-27");
  await page.getByRole("link", { name: "Confirmed hours Show or share the weekly record" }).click();
  await expect(page.getByRole("heading", { name: "Confirmed hours" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alex Example" })).toBeVisible();
  await expect(page.getByText("Week total").first()).toBeVisible();
});

test("weekly navigation changes the selected week", async ({ page }) => {
  await page.goto("/weeks/demo-week-27/comparison");
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/\/weeks\/demo-week-28\/comparison$/);
  await expect(page.getByText("Week of 2026-07-06")).toBeVisible();
  await page.getByRole("link", { name: "All weeks" }).click();
  await expect(page).toHaveURL(/\/weeks$/);
});

test("workflow 5 photo inbox prioritizes the assignment queue", async ({ page }) => {
  await page.goto("/photos");
  await expect(page.getByRole("heading", { name: "Needs assignment" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This week's evidence" })).toBeVisible();
  await expect(page.getByText(/Other weeks \(\d+\)/)).toBeVisible();
});

test("employee history shows confirmed hours across loaded weeks", async ({ page }) => {
  await page.goto("/employees/employee-alex-example");
  await expect(page.getByRole("heading", { name: "Alex Example" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Hours by week" })).toBeVisible();
  await expect(page.getByText("4 recorded weeks")).toBeVisible();
});

test("clicking a row name updates its source-row zoom", async ({ page }) => {
  await page.goto("/weeks/demo-week-28/actual");
  await page.getByRole("button", { name: "Alex Example" }).first().click();
  await expect(page.getByRole("heading", { name: "Row zoom: Alex Example" }).first()).toBeVisible();
});

test("weeks can switch between the original list and monthly calendar", async ({ page }) => {
  await page.goto("/weeks?view=calendar&month=2026-06");
  await expect(page.getByRole("heading", { name: "June 2026", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Calendar", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("columnheader", { name: "Mon", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Next month", exact: true }).click();
  await expect(page.getByRole("heading", { name: "July 2026", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "List", exact: true }).click();
  await expect(page.getByText("Week starting 2026-06-29", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "List", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "July 2026", exact: true })).toBeVisible();
});

test("a calendar day opens its paper and the date filter remains changeable", async ({ page }) => {
  await page.goto("/weeks?view=calendar&month=2026-07");
  await page.locator('a.sheet-day.loaded[href*="demo-week-28"]').first().click();
  const date = new URL(page.url()).searchParams.get("date")!;
  await expect(page.getByRole("combobox", { name: "Date", exact: true })).toHaveValue(date);
  await expect(page.getByRole("heading", { name: `${date} paper`, exact: true }).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Date", exact: true }).selectOption("all");
  await expect(page.getByRole("combobox", { name: "Date", exact: true })).toHaveValue("all");
  await page.goto("/weeks/demo-week-27");
  await expect(page.getByRole("region", { name: "Daily sheets", exact: true })).toBeVisible();
  await expect(page.locator(".week-sheets-grid .sheet-day")).toHaveCount(7);
});

test("calendar handles empty months, invalid queries and mobile overflow", async ({ page }) => {
  await page.goto("/weeks?view=calendar&month=2026-13");
  await expect(page.getByRole("region", { name: "Monthly sheet calendar", exact: true })).toBeVisible();
  await page.goto("/weeks?view=calendar&month=2030-02");
  await expect(page.getByRole("heading", { name: "February 2030", exact: true })).toBeVisible();
  await expect(page.locator(".sheet-day.loaded")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Swipe across to see all seven days.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("year overview groups weekly coverage under all twelve months", async ({ page }) => {
  await page.goto("/weeks?view=year&year=2026");
  await expect(page.getByRole("link", { name: "Year", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "2026 · Weekly sheets", exact: true })).toBeVisible();
  await expect(page.locator(".year-weeks-table")).toHaveCSS("table-layout", "fixed");
  await expect(page.locator(".year-month-row")).toHaveCount(12);
  const july = page.locator("#year-month-2026-07");
  await expect(july.locator(".year-week-row")).toHaveCount(2);
  await expect(july.getByText("0/2", { exact: true })).toBeVisible();
  await expect(july.getByText("3/7", { exact: true })).toBeVisible();
  await expect(july.getByText("6 July – 12 July", { exact: true })).toBeVisible();
  await july.getByRole("link", { name: "Open week starting 2026-07-06", exact: true }).click();
  await expect(page).toHaveURL(/\/weeks\/demo-week-28$/);
});

test("year navigation handles empty years, month drilldown and mobile layout", async ({ page }) => {
  await page.goto("/weeks?view=year&year=2030");
  await expect(page.getByText("No weeks recorded", { exact: true })).toHaveCount(12);
  await page.getByRole("link", { name: "Previous year", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2029 · Weekly sheets", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".year-weeks-table")).toHaveCSS("table-layout", "fixed");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.locator("#year-month-2029-07").getByRole("link", { name: "July", exact: true }).click();
  await expect(page).toHaveURL(/view=calendar&month=2029-07$/);
  await expect(page.getByRole("heading", { name: "July 2029", exact: true })).toBeVisible();
  await page.goto("/weeks?view=year&year=wrong");
  await expect(page.getByRole("region", { name: "Yearly weeks overview", exact: true })).toBeVisible();
});
