import { test, expect } from '@playwright/test';
import { watch, open } from './helpers-b.mjs';

test('E32 CSP + roles + tab order + focus outline', async ({ page }) => {
  const bad = watch(page);
  await open(page);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("connect-src 'self'");
  for (const name of ['Play', 'Step', 'Reset', 'About', 'Ask JEV']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  // every non-decorative canvas (aria-hidden thumbnails excluded) is an image with a label
  const canvases = await page.evaluate(() => [...document.querySelectorAll('canvas')].filter((c) => !c.closest('[aria-hidden="true"]'))
    .map((c) => ({ role: c.getAttribute('role'), label: c.getAttribute('aria-label') || '' })));
  expect(canvases.length).toBeGreaterThan(0);
  for (const c of canvases) { expect(c.role).toBe('img'); expect(c.label.length).toBeGreaterThan(0); }

  const regions = [];
  let outlines = 0;
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return {
        region: el.closest('#app-header') ? 'header' : el.closest('.col-left') ? 'input' : el.closest('#circuit-panel') ? 'circuit' : el.closest('#dashboard') ? 'dashboard' : 'other',
        outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
      };
    });
    if (!regions.includes(r.region)) regions.push(r.region);
    if (i < 3 && r.outline) outlines++;
  }
  expect(regions.filter((r) => r !== 'other')).toEqual(['header', 'input', 'circuit', 'dashboard']);
  expect(outlines).toBe(3);
  expect(bad).toEqual([]);
});
