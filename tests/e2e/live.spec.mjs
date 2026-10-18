import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { MOCK, Q, SHOT, tid, watch, run, state, setRange, open, goLive, waitLog } from './helpers-a.mjs';

test('E12 replay', async ({ page }) => {
  // SPEC-ISSUE E12: tests/fixtures/recording.json features [.83,.08,.04,.04,.8] vs app vbar [.91,.02,.02,.06,.59]: L1 0.40 > 0.25 limit -> only `unrecorded`. See report.
  test.fail();
  const errs = watch(page);
  const rec = readFileSync('tests/fixtures/recording.json', 'utf8');
  await page.route('**/data/jev-recording.json', (r) => r.fulfill({ contentType: 'application/json', body: rec }));
  await open(page);
  await page.reload();
  await page.waitForFunction(() => window.__mc);
  await expect(tid(page, 'mode-select-replay')).toBeEnabled();
  await tid(page, 'mode-select-replay').click();
  await expect(tid(page, 'mode-badge')).toContainText('REPLAY JEV');
  await tid(page, 'stimulus-preset-vbar').click();
  await run(page, 4000);
  // fixture holds one entry: other requests legitimately log `unrecorded`; at least one must match.
  await expect.poll(() => tid(page, 'jev-log-entry').filter({ hasText: /(exact|nearest)/ }).count()).toBeGreaterThan(0);
  await page.screenshot({ path: SHOT('E12-replay'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test('E14 runaway', async ({ page }) => {
  const errs = watch(page);
  await open(page);
  await setRange(page, 'param-theta', 5);
  await setRange(page, 'param-g', 0);
  await setRange(page, 'param-sigmaV', 10);
  await setRange(page, 'param-tauM', 1);
  await run(page, 6000);
  await expect(tid(page, 'runaway-warning')).toBeVisible();
  await page.screenshot({ path: SHOT('E14-runaway'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test('E15 budget', async ({ page }) => {
  const errs = watch(page);
  await open(page, Q, MOCK);
  await goLive(page);
  await tid(page, 'param-budget').fill('2');
  await setRange(page, 'param-liveMinIntervalMs', 1000);
  await expect(tid(page, 'param-autoJev')).toBeChecked();
  await tid(page, 'stimulus-preset-vbar').click();
  for (let i = 0; i < 3; i++) {
    const ok = () => tid(page, 'jev-log-entry').filter({ hasText: /\bok\b/ }).count();
    const n = await ok();
    await run(page, 1000);
    if (i < 2) await expect.poll(ok, { timeout: 5000 }).toBeGreaterThan(n);
    else await page.waitForTimeout(300);
    await page.waitForTimeout(1100);
  }
  await expect(tid(page, 'banner')).toContainText(/budget/i);
  await expect(tid(page, 'mode-badge')).toHaveText('SIMULATED JEV');
  await expect(tid(page, 'mode-select-live')).toBeDisabled();
  expect(await tid(page, 'jev-log-entry').filter({ hasText: /\bok\b/ }).count()).toBe(2);
  await page.screenshot({ path: SHOT('E15-budget'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test.describe('E16 reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('E16', async ({ page }) => {
    const errs = watch(page);
    await open(page);
    await tid(page, 'stimulus-preset-vbar').click();
    const fills = () => page.locator('[data-testid^="neuron-"]').evaluateAll((els) => els.map((e) => e.getAttribute('style') + getComputedStyle(e.firstElementChild ?? e).fill).join('|'));
    const a = await fills();
    for (let i = 0; i < 4; i++) { await run(page, 200); expect(await page.locator('.particle').count()).toBe(0); }
    expect(await fills()).not.toBe(a);
    await page.screenshot({ path: SHOT('E16-reduced-motion'), animations: 'disabled' });
    expect(errs).toEqual([]);
  });
});

test('E34 particle cap', async ({ page }) => {
  const errs = watch(page);
  await page.goto('/?autoplay=1&seed=42');
  await setRange(page, 'speed-slider', 6); // index 6 = 1000 %
  await tid(page, 'stimulus-preset-vbar').click();
  let max = 0;
  for (let i = 0; i < 30; i++) {
    max = Math.max(max, await page.locator('.particle').count());
    await page.waitForTimeout(100);
  }
  expect(max).toBeLessThanOrEqual(300);
  test.info().annotations.push({ type: 'max-particles', description: String(max) });
  expect(errs).toEqual([]);
});

test('E17 draw', async ({ page }) => {
  const errs = watch(page);
  await open(page);
  const c = tid(page, 'draw-canvas');
  const b = await c.boundingBox();
  const x = b.x + b.width / 2;
  await page.mouse.move(x, b.y + b.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(x, b.y + b.height * 0.5, { steps: 8 });
  await page.mouse.move(x, b.y + b.height * 0.9, { steps: 8 });
  await page.mouse.up();
  await tid(page, 'btn-draw-use').click();
  const col = await tid(page, 'stimulus-preview').evaluate((cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const lum = (px, py) => d[(py * cv.width + px) * 4];
    return { mid: lum(Math.floor(cv.width / 2), Math.floor(cv.height / 2)), side: lum(2, Math.floor(cv.height / 2)) };
  });
  expect(col.mid).toBeGreaterThan(col.side + 100);
  const s = await run(page, 4000);
  expect(s.readoutLocal).toBe('vertical');
  await page.screenshot({ path: SHOT('E17-draw'), animations: 'disabled' });
  expect(errs).toEqual([]);
});
