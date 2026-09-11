import { expect, test } from '@playwright/test';
import { routes } from './routes';

/**
 * Layout checks at every width the console claims to support.
 *
 * The rule is that the page itself never scrolls sideways. Tables, diagrams and source
 * blocks may be wider than the viewport, but each must scroll inside its own container,
 * which is what the second assertion verifies.
 */
for (const route of routes) {
  test(`${route} does not scroll sideways`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
    });
    expect(overflow.scrollWidth, `${route} overflows horizontally`)
      .toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test(`${route} keeps wide content inside a scroll container`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    const escapees = await page.evaluate(() => {
      const root = document.documentElement;
      const clipped = (element: Element) => {
        let parent = element.parentElement;
        while (parent) {
          const overflowX = getComputedStyle(parent).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') return true;
          parent = parent.parentElement;
        }
        return false;
      };
      return [...document.querySelectorAll('body *')]
        .filter(element => element.getBoundingClientRect().right > root.clientWidth + 1)
        .filter(element => !clipped(element))
        .map(element => `${element.tagName}.${String(element.className).slice(0, 40)}`)
        .slice(0, 5);
    });
    expect(escapees, `${route} has content wider than the viewport outside any scroller`).toEqual([]);
  });

  test(`${route} has one main landmark and one first-level heading`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).not.toBeEmpty();
  });
}
