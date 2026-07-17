import { test, expect } from "@playwright/test";

test("workflow 1 opens a fictional week and sees review status", async ({ page }) => {
  await page.goto("/weeks");
  await expect(page.getByText("Demo workspace: all records are fictional and changes are disabled.")).toBeVisible();
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
  await expect(page.getByText("demo-weekly-payslip.png")).toBeVisible();
});

test("workflow 4 confirmed hours can be shown as a weekly summary", async ({ page }) => {
  await page.goto("/weeks/demo-week-27");
  await page.getByRole("link", { name: /confirmed hours/i }).click();
  await expect(page.getByRole("heading", { name: "Confirmed hours" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alex Example" })).toBeVisible();
  await expect(page.getByText("Week total").first()).toBeVisible();
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
  await expect(page.getByText("2 recorded weeks")).toBeVisible();
});

test("clicking a row name updates its source-row zoom", async ({ page }) => {
  await page.goto("/weeks/demo-week-28/actual");
  await page.getByRole("button", { name: "Alex Example" }).first().click();
  await expect(page.getByRole("heading", { name: "Row zoom: Alex Example" }).first()).toBeVisible();
});
