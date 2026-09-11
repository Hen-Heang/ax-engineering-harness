import { expect, test } from '@playwright/test';

/**
 * The persistent sidebar, which exists above the `lg` breakpoint.
 *
 * Which viewports run this file is decided in the Playwright config rather than by
 * skipping at runtime, so a spec never reports as skipped when it simply does not
 * apply.
 */

test('the sidebar is present and marks the current page', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Console sections' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
});

test('a section link navigates and moves the current marker', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Console sections' });
  await nav.getByRole('link', { name: 'Policies' }).click();
  await expect(page).toHaveURL(/\/policies$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Policies' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Policies' })).toHaveAttribute('aria-current', 'page');
});

test('every section reaches a page rather than a placeholder', async ({ page }) => {
  await page.goto('/');
  const links = page.getByRole('navigation', { name: 'Console sections' }).getByRole('link');
  const count = await links.count();
  expect(count).toBe(14);
  for (let index = 0; index < count; index += 1) {
    await expect(links.nth(index)).toHaveAttribute('href', /^\//);
  }
});

test('the first focusable element shows a visible focus ring', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return null;
    const style = getComputedStyle(element);
    return { tag: element.tagName, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
  });

  expect(focus, 'Tab should move focus into the page').not.toBeNull();
  const visible = focus !== null && (focus.outlineWidth !== '0px' || focus.boxShadow !== 'none');
  expect(visible, `focus on ${focus?.tag ?? 'nothing'} is not visible`).toBe(true);
});

test('a definition list expands with the keyboard alone', async ({ page }) => {
  await page.goto('/agents');
  const summary = page.locator('details summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
});

test('the adoption simulator switches stacks from the keyboard', async ({ page }) => {
  await page.goto('/projects');
  const buttons = page.getByRole('group', { name: 'Choose a stack' }).getByRole('button');
  await expect(buttons).toHaveCount(3);
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'true');

  await buttons.nth(2).focus();
  await page.keyboard.press('Enter');
  await expect(buttons.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(buttons.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Areas and the roles that own them')).toBeVisible();
});
