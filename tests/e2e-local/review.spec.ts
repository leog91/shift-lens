import { test, expect } from '@playwright/test';

test('dismiss, rescan, restore, correct and backup preserve review history', async ({ page, request }) => {
  await page.goto('/weeks/lifecycle/actual');
  await expect(page.getByRole('status').filter({ hasText: 'Cloud sync is not configured. All data remains local.' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Employee', exact: true }).selectOption('one');
  await page.getByRole('button', { name: 'Dismiss: incorrect OCR', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fictional one', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('dismissed');
  await expect(page.getByRole('button', { name: 'Restore to review' })).toBeVisible();
  await page.getByRole('button', { name: 'Rescan papers and add missing OCR rows' }).click();
  await expect(page.getByText(/OCR completed/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Employee', exact: true })).toHaveValue('one');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('dismissed');
  await page.getByRole('button', { name: 'Restore to review' }).click();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'Edit values', exact: true }).click();
  await page.getByRole('textbox', { name: 'Fictional one start', exact: true }).fill('');
  await page.getByRole('textbox', { name: 'Fictional one correction reason' }).fill('Start unreadable on fictional paper');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Add missing values' })).toBeVisible();
  await page.getByText('Source and review history', { exact: true }).click();
  await expect(page.getByText(/Start unreadable on fictional paper/)).toBeVisible();
  await expect(page.getByText(/restore — incorrect ocr row/)).toBeVisible();
  const backup = await (await request.post('/api/backups/create')).json();
  expect(backup.ok).toBe(true);
  const changed = await request.post('/api/shifts/update', { data: { weekId: 'lifecycle', shiftId: 'manual-ocr-lifecycle', startTime: '12:00', finishTime: '17:00', breakMinutes: 0 } });
  expect(changed.ok()).toBe(true);
  expect((await request.post('/api/backups/restore', { data: { backupId: backup.backup.id } })).ok()).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Rescan this page' }).click();
  await expect(page.getByText(/OCR completed/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add missing values' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fictional one', exact: true })).toHaveCount(1);
});

test('confirmation network failure permits retry', async ({ page }) => {
  await page.goto('/weeks/network/actual');
  await page.route('**/api/shifts/confirm', (route) => route.abort('failed'), { times: 1 });
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('confirmed', { exact: true })).toBeVisible();
});

test('missing row preserves filters and permits replacement of a dismissed proposal', async ({ page }) => {
  await page.goto('/weeks/add/actual');
  await page.getByRole('combobox', { name: 'Employee', exact: true }).selectOption('one');
  await page.getByRole('button', { name: 'Dismiss: incorrect OCR', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fictional one', exact: true })).toHaveCount(0);
  await page.getByLabel('Employee for missing row').selectOption('one');
  await page.getByRole('textbox', { name: 'Start time for missing row' }).fill('09:30');
  await page.getByRole('textbox', { name: 'Finish time for missing row' }).fill('17:00');
  await page.getByRole('textbox', { name: 'Break minutes for missing row' }).fill('0');
  await page.getByRole('button', { name: 'Add row', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Employee', exact: true })).toHaveValue('one');
  await expect(page.getByRole('cell', { name: '09:30', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('confirmed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rescan this page' }).click();
  await expect(page.getByText(/OCR completed/)).toBeVisible();
  await expect(page.getByRole('cell', { name: '09:30', exact: true })).toBeVisible();
});

test('source coordinates scale with the image height', async ({ page }) => {
  await page.goto('/weeks/geometry/actual');
  const image = page.getByRole('img', { name: 'Magnified source row for Fictional one' });
  const box = page.locator('[data-source-field="employee"]');
  await expect(box).toBeVisible();
  for (const width of [1200, 700]) {
    await page.setViewportSize({ width, height: 900 });
    const container = await image.boundingBox(); const rect = await box.boundingBox();
    expect(container).not.toBeNull(); expect(rect).not.toBeNull();
    expect(Math.abs(rect!.y - container!.y - container!.height * 0.5)).toBeLessThan(2);
    expect(Math.abs(container!.height / container!.width - 2)).toBeLessThan(0.01);
  }
});

test('editing during an OCR request survives its final write', async ({ request }) => {
  const scan = request.post('/api/extraction/batch', { data: { weekId: 'concurrency' } });
  const update = await request.post('/api/shifts/update', { data: { weekId: 'concurrency', shiftId: 'ocr-concurrency', startTime: '11:00', finishTime: '17:00', breakMinutes: 0, correctionReason: 'Concurrent fictional correction' } });
  expect(update.ok()).toBe(true);
  const result = await (await scan).json();
  expect(result.ok).toBe(true);
  expect(result.shifts).toHaveLength(1);
  expect(result.shifts[0]).toMatchObject({ id: 'manual-ocr-concurrency', startTime: '11:00' });
});
