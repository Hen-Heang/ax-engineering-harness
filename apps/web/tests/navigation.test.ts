import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { availableNavItems, navItems, navigation } from '../lib/navigation';

const webRoot = fileURLToPath(new URL('../', import.meta.url));

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

test('the navigation covers the sections the console is meant to have', () => {
  assert.deepEqual(
    navigation.map(section => section.label),
    [null, 'Building blocks', 'Integrations', 'Quality', 'Adoption', 'Reference'],
  );
  assert.deepEqual(
    navItems.map(item => item.label),
    [
      'Overview', 'Architecture', 'Workflow',
      'Profiles', 'Agents', 'Skills',
      'MCP & tools', 'Policies',
      'Quality gates', 'Evals', 'Runs',
      'Projects',
      'Docs',
    ],
  );
});

test('every navigation entry is uniquely labelled and carries an icon and a phase', () => {
  assert.equal(new Set(navItems.map(item => item.label)).size, navItems.length);
  for (const item of navItems) {
    // Lucide components are forwardRef objects rather than plain functions.
    assert.ok(item.icon, `${item.label} needs an icon`);
    assert.ok(['function', 'object'].includes(typeof item.icon), `${item.label} icon must be a component`);
    assert.ok(item.phase >= 8, `${item.label} phase`);
  }
});

test('an item is a link only when its page exists', async () => {
  assert.ok(availableNavItems.length > 0, 'at least one page must be reachable');
  for (const item of availableNavItems) {
    assert.ok(item.href?.startsWith('/'), `${item.label} href`);
    const segment = item.href === '/' ? '' : item.href?.slice(1);
    const route = join(webRoot, 'app', segment ?? '', 'page.tsx');
    assert.ok(await exists(route), `${item.label} links to ${item.href} but ${route} does not exist`);
  }
});

test('an unbuilt section is listed without a destination', () => {
  const planned = navItems.filter(item => item.href === null);
  assert.ok(planned.length > 0, 'later phases are still listed');
  for (const item of planned) {
    assert.equal(item.href, null, `${item.label} must not link anywhere yet`);
    assert.ok(item.phase > 8, `${item.label} should be delivered by a later phase`);
  }
});

test('hrefs are unique, so no two sections claim the same page', () => {
  const hrefs = availableNavItems.map(item => item.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});
