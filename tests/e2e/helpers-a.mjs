import { expect } from '@playwright/test';
// T16a helpers: console filter (FR-TST-07), __mc shortcuts, mock URL. No shared file with T16b.
export const MOCK = `http://127.0.0.1:${process.env.PW_MOCK_PORT || 8790}`;
export const Q = '?test=1&autoplay=0&seed=42';
export const SHOT = (n) => `tests/screenshots/${n}.png`;
export const tid = (page, id) => page.getByTestId(id);

// extra = [{url: RegExp, text?: RegExp}] expected error lines per scenario.
export function watch(page, extra = []) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const u = m.location().url;
    if (/^Failed to load resource: the server responded with a status of 404/.test(m.text()) && /\/api\/health$/.test(u)) return;
    if (extra.some((x) => x.url.test(u) && (!x.text || x.text.test(m.text())))) return;
    errors.push(`${m.text()} @ ${u}`);
  });
  return errors;
}

export const mc = (page, fn, arg) => page.evaluate(([f, a]) => window.__mc[f](...a), [fn, arg ?? []]);
export const run = (page, n) => mc(page, 'runSteps', [n]);
export const state = (page) => mc(page, 'getState');
export const raf2 = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// Range inputs: set value + fire input (Playwright fill does not support range).
export const setRange = (page, id, v) => tid(page, id).evaluate((el, x) => { el.value = String(x); el.dispatchEvent(new Event('input', { bubbles: true })); }, v);

export async function open(page, qs = Q, base = '') {
  await page.goto(`${base}/${qs}`);
  if (qs.includes('test=1')) await page.waitForFunction(() => window.__mc);
  await raf2(page);
}

export const healthNoKey = (page) => page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, keySource: 'none', model: 'jev-latest', budget: { used: 0, cap: 50 }, mock: true, recording: false } }));

export async function goLive(page) {
  await tid(page, 'mode-select-live').click();
  await expect(tid(page, 'mode-badge')).toHaveText('LIVE JEV');
}

// Wait for log entry count to exceed n (max ms). Polling, not waitForFunction (page CSP forbids eval).
export const waitLog = (page, n, ms = 5000) =>
  expect.poll(() => tid(page, 'jev-log-entry').count(), { timeout: ms }).toBeGreaterThan(n);
