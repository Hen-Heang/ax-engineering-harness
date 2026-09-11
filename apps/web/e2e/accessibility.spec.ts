import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { routes } from './routes';

/**
 * Automated accessibility checks.
 *
 * axe finds a real subset of problems, not all of them. Passing here means no
 * automatically detectable violation of the rules below; it is not a claim that the
 * console is fully accessible, and the documentation says so.
 *
 * Run at the widest and narrowest supported sizes, where the layout differs most.
 */
test.describe('accessibility', () => {
  for (const route of routes) {
    test(`${route} has no automatically detectable violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const summary = results.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map(node => node.target.join(' ')).slice(0, 3),
      }));

      expect(summary, `${route} has accessibility violations`).toEqual([]);
    });
  }
});
