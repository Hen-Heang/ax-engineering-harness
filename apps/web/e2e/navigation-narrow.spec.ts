import { expect, test } from '@playwright/test';

/**
 * The mobile sheet, which replaces the sidebar below the `lg` breakpoint.
 */

test('the sidebar is replaced by a sheet that opens, navigates and closes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Console sections' })).toBeHidden();

  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await expect(trigger).toBeVisible();

  // A comfortable touch target, not merely a clickable one.
  const box = await trigger.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('link', { name: 'Agents' }).click();
  await expect(page).toHaveURL(/\/agents$/);
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('the sheet closes on Escape and returns focus to its trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Open navigation' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('sheet links are large enough to tap', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const links = page.getByRole('dialog').getByRole('link');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await links.nth(index).boundingBox();
    expect(box?.height ?? 0, `link ${index} is too short to tap`).toBeGreaterThanOrEqual(44);
  }
});

test('opening the sheet does not let the page scroll sideways', async ({ page }) => {
  await page.goto('/policies');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
