import { test, expect } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MOCK, Q, watch, open, state, run, idle, routeNoKey, slider } from './helpers-b.mjs';

const SHOT = (n) => `tests/screenshots/${n}.png`;

test('E18 file:// shows notice', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve('docs/index.html')).href);
  const n = page.getByTestId('file-protocol-notice');
  await expect(n).toBeVisible();
  await expect(n).toContainText('node tools/jev-proxy.mjs');
  await page.screenshot({ path: SHOT('E18-file-protocol'), animations: 'disabled' });
});

test('E19 fps (soft)', async ({ page }) => {
  test.setTimeout(30000);
  const bad = watch(page);
  await open(page, '/?test=1&debug=1&seed=42'); // autoplay on
  const fps = await page.evaluate(() => new Promise((res) => {
    const per = []; let c = 0, t0 = performance.now();
    const tick = (now) => {
      c++;
      if (now - t0 >= 1000) { per.push(c * 1000 / (now - t0)); c = 0; t0 = now; }
      if (per.length >= 10) res(per); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  const med = [...fps].sort((a, b) => a - b)[fps.length >> 1];
  test.info().annotations.push({ type: 'E19 median fps', description: med.toFixed(1) });
  await expect(page.getByTestId('fps-meter')).toBeVisible();
  expect(bad).toEqual([]);
});

test.use({ launchOptions: { args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] } });
{
  test('E20 memory growth <= 10%', async ({ page }) => {
    test.setTimeout(150000);
    const bad = watch(page);
    await open(page, '/?test=1&seed=42');
    await slider(page, 'speed-slider', 6);
    const heap = async () => { await page.evaluate(() => window.gc?.()); return page.evaluate(() => performance.memory.usedJSHeapSize); };
    await page.waitForTimeout(10000);
    const a = await heap();
    await page.waitForTimeout(50000);
    const b = await heap();
    test.info().annotations.push({ type: 'E20 heap', description: `${a} -> ${b}` });
    expect(b).toBeLessThanOrEqual(a * 1.1);
    expect(bad).toEqual([]);
  });
}

test('E21 health + recording unreachable', async ({ page }) => {
  const bad = watch(page, [{ url: /\/api\/health$|\/data\/jev-recording\.json$/, text: /net::ERR_FAILED/ }]);
  await open(page);
  await page.route('**/api/health', (r) => r.abort());
  await page.route('**/data/jev-recording.json', (r) => r.abort());
  await page.reload();
  await page.waitForFunction(() => window.__mc);
  await idle(page);
  await expect(page.getByTestId('mode-select-live')).toBeDisabled();
  await expect(page.getByTestId('mode-select-replay')).toBeDisabled();
  expect((await run(page, 200)).t).toBe(100);
  expect(bad).toEqual([]);
});

test('E22 hidden tab pauses', async ({ page }) => {
  const bad = watch(page);
  await page.addInitScript(() => {
    window.__vis = 'visible';
    Object.defineProperty(document, 'visibilityState', { get: () => window.__vis, configurable: true });
  });
  await open(page, '/?test=1&seed=42'); // autoplay
  await expect.poll(async () => (await state(page)).run).toBe(true);
  await page.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
  expect((await state(page)).run).toBe(false);
  const t = (await state(page)).t;
  await idle(page);
  expect((await state(page)).t).toBe(t);
  await page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  expect((await state(page)).run).toBe(true);
  expect(bad).toEqual([]);
});

test('E23 rapid Play/Reset, single rAF loop', async ({ page }) => {
  const bad = watch(page);
  await open(page);
  await page.evaluate(() => {
    const c = (id) => document.querySelector(`[data-testid="${id}"]`).click();
    for (let i = 0; i < 20; i++) c('btn-play');
    for (let i = 0; i < 10; i++) c('btn-reset');
  });
  expect((await state(page)).run).toBe(false); // 20 toggles from idle
  await page.getByTestId('btn-play').click();
  expect((await state(page)).run).toBe(true);
  const deltas = await page.evaluate(() => new Promise((res) => {
    const d = []; let last = window.__mc.getState().frame, n = 0;
    const tick = () => {
      const f = window.__mc.getState().frame;
      d.push(f - last); last = f;
      if (++n >= 60) res(d); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  expect(Math.max(...deltas.slice(1))).toBeLessThanOrEqual(1);
  expect(bad).toEqual([]);
});

test('E24 reset aborts delayed LIVE call', async ({ page }) => {
  test.setTimeout(30000);
  const bad = watch(page);
  await page.route('**/api/jev', async (r) => {
    try { const res = await r.fetch(); await new Promise((x) => setTimeout(x, 3000)); await r.fulfill({ response: res }); } catch { /* page gone */ }
  });
  await open(page, `${MOCK}/${Q}`);
  await expect(page.getByTestId('mode-select-live')).toBeEnabled();
  await page.getByTestId('mode-select-live').click();
  await expect(page.getByTestId('mode-badge')).toHaveText('LIVE JEV');
  await page.getByTestId('btn-ask-jev').click();
  await page.waitForTimeout(500);
  await page.getByTestId('btn-reset').click();
  await expect(page.getByTestId('jev-log-entry').filter({ hasText: 'aborted' })).toHaveCount(1);
  await page.waitForTimeout(3500);
  await expect(page.getByTestId('jev-log-entry').filter({ hasText: / · ok · / })).toHaveCount(0);
  expect(bad).toEqual([]);
});

test('E25 storage throws -> memory-only key', async ({ page }) => {
  const bad = watch(page);
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
  await routeNoKey(page);
  await open(page, `${MOCK}/${Q}`);
  await expect(page.getByTestId('btn-key')).toBeEnabled();
  await page.getByTestId('btn-key').click();
  await page.getByTestId('key-input').fill('test-key-FAKE-2525');
  await page.getByTestId('btn-key-save').click();
  await expect(page.getByTestId('banner')).toContainText(/tab only|memory/i);
  expect(bad).toEqual([]);
});

test('E26 XSS-looking seed', async ({ page }) => {
  const bad = watch(page);
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await open(page);
  await page.getByTestId('seed-input').fill('<img src=x onerror=alert(1)>');
  await page.getByTestId('btn-seed-apply').click();
  await expect(page.getByTestId('banner')).toHaveAttribute('data-level', 'error');
  await idle(page);
  expect(dialogs).toBe(0);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  expect(await page.getByTestId('banner-text').innerHTML()).not.toContain('<img');
  expect(bad).toEqual([]);
});

test('E27 seed edge values', async ({ page }) => {
  const bad = watch(page);
  await open(page);
  for (const v of ['0', '4294967295']) {
    await page.getByTestId('seed-input').fill(v);
    await page.getByTestId('btn-seed-apply').click();
    await expect(page).toHaveURL(new RegExp(`seed=${v}(&|$)`));
    expect((await run(page, 200)).t).toBe(100);
  }
  await page.getByTestId('seed-input').fill('-1');
  await page.getByTestId('btn-seed-apply').click();
  await expect(page.getByTestId('banner')).toHaveAttribute('data-level', 'error');
  await expect(page).toHaveURL(/seed=4294967295(&|$)/);
  expect(bad).toEqual([]);
});

test('E28 key in URL stripped', async ({ page }) => {
  const bad = watch(page);
  await open(page, '/?key=sk-FAKE-abcdefghijklmnop&test=1&autoplay=0');
  expect(page.url()).not.toContain('key=');
  await expect(page.getByTestId('banner')).toHaveAttribute('data-level', 'warn');
  expect(bad).toEqual([]);
});

test('E29 determinism', async ({ page }) => {
  const bad = watch(page);
  const hash = async (seed) => { await open(page, `/?seed=${seed}&test=1&autoplay=0`); return (await run(page, 4000)).rasterHash; };
  const a = await hash(7), b = await hash(7), c = await hash(8);
  expect(a).toBe(b);
  expect(c).not.toBe(a);
  expect(bad).toEqual([]);
});

test('E30 keyboard', async ({ page }) => {
  const bad = watch(page);
  await open(page);
  await page.keyboard.press('Space');
  expect((await state(page)).run).toBe(true);
  await page.keyboard.press('Space');
  expect((await state(page)).run).toBe(false);
  const t0 = (await state(page)).t;
  await page.keyboard.press('s');
  expect((await state(page)).t).toBe(t0 + 5);
  await page.keyboard.press('r');
  expect((await state(page)).t).toBe(0);
  let hit = false;
  for (let i = 0; i < 120 && !hit; i++) {
    await page.keyboard.press('Tab');
    hit = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'neuron-L4E-0');
  }
  expect(hit).toBe(true);
  await page.keyboard.press('Enter');
  expect((await state(page)).selection).toEqual(['L4E-0']);
  expect(bad).toEqual([]);
});
