import { test, expect } from "@playwright/test";

test("employee rankings support every period and retain ranks when filtering", async ({ page }) => {
  await page.goto("/hours");
  await expect(page.getByRole("heading", { name: "Employee hours ranking" })).toBeVisible();
  const table = page.getByRole("table", { name: "Hours by employee", exact: true });
  for (const period of ["day", "week", "month", "year", "total"]) {
    await page.getByRole("combobox", { name: "Period", exact: true }).selectOption(period);
    if (period !== "total") await expect(page.getByRole("combobox", { name: `Choose ${period}`, exact: true })).toBeVisible();
    if (period === "day") await page.getByRole("combobox", { name: "Choose day", exact: true }).selectOption("2026-07-06");
    await expect(table.getByRole("columnheader", { name: "Rank", exact: true })).toBeVisible();
  }
  const rows = table.locator("tbody tr");
  const firstRank = await rows.first().getByRole("cell").first().innerText();
  expect(firstRank).toBe("#1");
  const name = await rows.last().getByRole("link").innerText();
  const rank = await rows.last().getByRole("cell").first().innerText();
  await page.getByRole("combobox", { name: "Employee", exact: true }).selectOption({ label: name });
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole("cell").first()).toHaveText(rank);
});

test("hours show worked-day counts and colored paper coverage", async ({ page }) => {
  await page.goto("/hours");
  const period = page.getByRole("combobox", { name: "Period", exact: true });
  await period.selectOption("week");
  await page.getByRole("combobox", { name: "Choose week", exact: true }).selectOption("2026-07-06");
  const table = page.getByRole("table", { name: "Hours by employee", exact: true });
  const row = table.getByRole("row").filter({ has: page.getByRole("link", { name: "Alex Example", exact: true }) });
  await expect(row.locator('[data-label="Days worked"]')).toHaveText("2");
  const coverage = page.getByRole("status", { name: "Daily paper coverage" });
  await expect(coverage).toHaveClass(/bg-amber-50/);
  await expect(coverage).toContainText("4 of 7 daily papers missing");
  await coverage.getByText("Show missing dates (4)", { exact: true }).click();
  await expect(coverage.getByRole("list", { name: "Missing daily paper dates" }).getByRole("listitem")).toHaveCount(4);
  await period.selectOption("day");
  const days = page.getByRole("combobox", { name: "Choose day", exact: true });
  await days.selectOption("2026-07-06");
  await expect(coverage).toHaveClass(/bg-green-50/);
  await expect(coverage).toContainText("Daily paper present");
  await expect(row.locator('[data-label="Days worked"]')).toHaveText("1");
  await days.selectOption("2026-07-07");
  await expect(coverage).toHaveClass(/bg-amber-50/);
  await expect(coverage).toContainText("1 of 1 daily papers missing");
  await expect(days.locator('option[value="2026-07-07"]')).toContainText("1 paper missing");
});

test("choosing a day shows employee day totals beside week totals", async ({ page }) => {
  await page.goto("/weeks/demo-week-28/hours");
  await page.getByRole("combobox", { name: "Day or week", exact: true }).selectOption("2026-07-06");
  const table = page.getByRole("table", { name: "Employee hours summary", exact: true });
  await expect(table.getByRole("columnheader", { name: "Day hours", exact: true })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Week hours", exact: true })).toBeVisible();
  await expect(table.getByRole("cell", { name: "Alex Example", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Day or week", exact: true }).selectOption("2026-07-12");
  await expect(page.getByText("No recorded shifts for this selection. Missing hours are not assumed to be zero.")).toBeVisible();
});
