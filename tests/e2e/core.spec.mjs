import { test, expect } from '@playwright/test';
import { MOCK, Q, SHOT, tid, watch, mc, run, state, raf2, setRange, open, healthNoKey, goLive, waitLog } from './helpers-a.mjs';

test('E01 initial load', async ({ page }) => {
  const errs = watch(page);
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.__mc);
  await mc(page, 'pause'); await raf2(page);
  await expect(page).toHaveTitle(/.+/);
  await expect(tid(page, 'app-title')).not.toBeEmpty();
  await expect(tid(page, 'pitch')).not.toBeEmpty();
  await expect(tid(page, 'mode-badge')).toHaveText('SIMULATED JEV');
  await expect(page.locator('[data-testid^="neuron-"]')).toHaveCount(58);
  await page.screenshot({ path: SHOT('E01-initial-load'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test('E02 running vbar', async ({ page }) => {
  const errs = watch(page);
  await open(page);
  await mc(page, 'setSeed', [42]);
  await tid(page, 'stimulus-preset-vbar').click();
  const s = await run(page, 2000);
  expect(s.t).toBe(1000);
  const g = s.spikeCountsByGroup.L4E;
  const top = Math.max(...g);
  expect(g.filter((x) => x === top).length).toBe(1);
  expect(g.indexOf(top)).toBe(0); // o=0 = vertical
  expect(s.readoutLocal).toBe('vertical');
  await expect(tid(page, 'readout-local')).toContainText(/vertical/i);
  await page.screenshot({ path: SHOT('E02-running-vbar'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test('E02b blank', async ({ page }) => {
  const errs = watch(page);
  await open(page);
  await mc(page, 'setSeed', [42]);
  await tid(page, 'stimulus-preset-blank').click();
  const s = await run(page, 4000);
  expect(s.readoutLocal).toBe('nothing');
  await expect(tid(page, 'readout-local')).toContainText(/nothing/i);
  await page.screenshot({ path: SHOT('E02b-blank'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test('E03 selected traces', async ({ page }) => {
  const errs = watch(page);
  await open(page);
  await tid(page, 'stimulus-preset-vbar').click();
  await tid(page, 'neuron-L23E-1').click();
  await tid(page, 'neuron-L4E-1').click({ modifiers: ['Shift'] });
  await run(page, 2000);
  const lbl = tid(page, 'selected-neuron-label');
  await expect(lbl).toContainText('L23E-1');
  await expect(lbl).toContainText('L4E-1');
  const nonEmpty = await tid(page, 'trace-canvas').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2] || d[i + 3] !== d[3]) return true;
    return false;
  });
  expect(nonEmpty).toBe(true);
  await page.screenshot({ path: SHOT('E03-selected-traces'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test('E04 choice bars', async ({ page }) => {
  const errs = watch(page);
  await open(page);
  await tid(page, 'stimulus-preset-vbar').click();
  await tid(page, 'neuron-L23E-1').click();
  for (const mode of ['hard', 'soft']) {
    await tid(page, `routing-${mode}`).check();
    await run(page, 2000);
    let sum = 0;
    for (const id of ['output', 'recurrent', 'lateral']) {
      const row = tid(page, `choice-bar-${id}`);
      await expect(row).toHaveCount(1);
      sum += Number(await row.getAttribute('data-p'));
    }
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: SHOT(`E04-choice-bars-${mode}`), animations: 'disabled' });
  }
  expect(errs).toEqual([]);
});

test('E05 key modal', async ({ page }) => {
  const errs = watch(page);
  const FULL = 'test-key-FAKE-789';
  await healthNoKey(page);
  await open(page, Q, MOCK);
  await expect(tid(page, 'btn-key')).toBeEnabled();
  await tid(page, 'btn-key').click();
  await tid(page, 'key-input').fill(FULL);
  await tid(page, 'btn-key-save').click();
  await tid(page, 'btn-key').click();
  await expect(tid(page, 'key-masked')).toHaveText('•••• -789');
  await page.screenshot({ path: SHOT('E05-key-modal'), animations: 'disabled' });
  const st = JSON.stringify(await state(page));
  const body = await page.evaluate(() => document.body.innerText);
  const ls = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  const ss = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
  expect(st).not.toContain(FULL);
  expect(body).not.toContain(FULL);
  expect(page.url()).not.toContain(FULL);
  expect(ls).not.toContain(FULL);
  expect(ss).toContain(FULL);
  expect(errs).toEqual([]);
});

test('E06 live mocked', async ({ page }) => {
  const errs = watch(page);
  await open(page, Q, MOCK);
  await goLive(page);
  await expect(tid(page, 'key-modal')).toBeHidden();
  await tid(page, 'param-autoJev').uncheck();
  await tid(page, 'stimulus-preset-vbar').click();
  await run(page, 1000);
  await tid(page, 'neuron-L23E-1').click();
  await tid(page, 'btn-ask-jev').click();
  await waitLog(page, 0);
  const log = tid(page, 'jev-log-entry').first();
  await expect(log).toContainText('ok');
  await log.locator('details').evaluate((d) => { d.open = true; });
  await expect(log).toContainText('jev-mock');
  await expect(tid(page, 'mode-badge')).toHaveText('LIVE JEV');
  await expect(tid(page, 'jev-budget')).toContainText('1 / 50');
  const hdr = await tid(page, 'compare-table').innerText();
  expect(hdr).toMatch(/Local/i);
  expect(hdr).toMatch(/JEV/);
  for (const id of ['compare-score', 'compare-noul', 'compare-choice']) {
    const cells = (await tid(page, id).locator('td,th').allInnerTexts()).map((x) => x.trim());
    expect(cells.length, id).toBeGreaterThanOrEqual(3); // label, Local, JEV
    expect(cells.slice(1).every((x) => x && x !== '—'), id + ' ' + cells).toBe(true);
  }
  await page.screenshot({ path: SHOT('E06-live-mocked'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

const E401 = [{ url: /\/api\/jev$/, text: /401/ }];
const reject401 = (r) => r.fulfill({ status: 401, json: { error: { code: 'unauthorized', message: 'Invalid API key' } } });

test('E07 error 401', async ({ page }) => {
  const errs = watch(page, E401);
  await healthNoKey(page);
  await page.route('**/api/jev', reject401);
  await open(page, Q, MOCK);
  await tid(page, 'btn-key').click();
  await tid(page, 'key-input').fill('test-key-FAKE-401');
  await tid(page, 'btn-key-save').click();
  await goLive(page);
  await tid(page, 'neuron-L23E-1').click();
  await tid(page, 'btn-ask-jev').click();
  await expect(tid(page, 'banner')).toContainText('401');
  await expect(tid(page, 'mode-badge')).toHaveText('SIMULATED JEV');
  await expect(tid(page, 'key-modal')).toBeVisible();
  await page.screenshot({ path: SHOT('E07-error-401'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test('E07b 401 mid-run', async ({ page }) => {
  const errs = watch(page, E401);
  let calls = 0;
  await healthNoKey(page);
  await page.route('**/api/jev', (r) => (++calls <= 2 ? r.continue() : reject401(r)));
  await open(page, Q, MOCK);
  await tid(page, 'btn-key').click();
  await tid(page, 'key-input').fill('test-key-FAKE-401');
  await tid(page, 'btn-key-save').click();
  await goLive(page);
  await setRange(page, 'param-liveMinIntervalMs', 1000);
  await tid(page, 'stimulus-preset-vbar').click();
  for (let i = 0; i < 3; i++) {
    const n = await tid(page, 'jev-log-entry').count();
    await run(page, 1000);
    await waitLog(page, n);
    await page.waitForTimeout(1100);
  }
  expect(calls).toBeGreaterThanOrEqual(3);
  await expect(tid(page, 'banner')).toBeVisible();
  await expect(tid(page, 'mode-badge')).toHaveText('SIMULATED JEV');
  const t0 = (await state(page)).t;
  await run(page, 100);
  expect((await state(page)).t).toBeGreaterThan(t0);
  expect(errs).toEqual([]);
});

test('E08 static no key', async ({ page }) => {
  const errs = watch(page);
  const origins = new Set();
  page.on('request', (r) => origins.add(new URL(r.url()).origin));
  await open(page);
  await expect(tid(page, 'mode-select-live')).toBeDisabled();
  await expect(tid(page, 'mode-select-live')).toHaveAttribute('title', /node tools\/jev-proxy\.mjs/);
  expect([...origins]).toEqual([new URL(page.url()).origin]);
  await page.screenshot({ path: SHOT('E08-no-key-simulated'), animations: 'disabled' });
  expect(errs).toEqual([]);
});

test('E09 mobile 375 @mobile', async ({ page }) => {
  const errs = watch(page);
  await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const id of ['btn-key', 'btn-play', 'btn-step', 'btn-reset', 'btn-about', 'btn-theme']) {
    await tid(page, id).scrollIntoViewIfNeeded();
    await expect(tid(page, id)).toBeVisible();
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: SHOT('E09-mobile-375'), animations: 'disabled' });
  expect(errs).toEqual([]);
});
