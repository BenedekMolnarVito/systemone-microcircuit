import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { MOCK, Q, watch, open, state, run, idle, setSeed, routeNoKey, slider } from './helpers-b.mjs';
import { validateRecording } from '../../docs/js/jev/replay.js';

const SHOT = (n) => `tests/screenshots/${n}.png`;

test('E31 static host: key disabled', async ({ page }) => {
  const bad = watch(page);
  await page.addInitScript(() => {
    window.__writes = [];
    for (const S of [Storage.prototype]) {
      const orig = S.setItem;
      S.setItem = function (k, v) { window.__writes.push(k); return orig.call(this, k, v); };
    }
  });
  await open(page);
  const btn = page.getByTestId('btn-key');
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute('title', 'Keys can only be used with the local proxy (node tools/jev-proxy.mjs)');
  await page.keyboard.press('k');
  await idle(page);
  await expect(page.getByTestId('key-modal')).toBeHidden();
  const r = await page.evaluate(() => ({
    local: Object.keys(localStorage), session: Object.keys(sessionStorage), writes: window.__writes,
  }));
  expect(r.local).not.toContain('smc.jevKey');
  expect(r.session).not.toContain('smc.jevKey');
  expect(r.writes).not.toContain('smc.jevKey');
  await page.screenshot({ path: SHOT('E31-static-key-disabled'), animations: 'disabled' });
  expect(bad).toEqual([]);
});

test('E33 params/selection/reset semantics', async ({ page }) => {
  const bad = watch(page);
  await open(page);
  await setSeed(page, 42);
  await page.getByTestId('stimulus-preset-vbar').click();
  await run(page, 200);
  await slider(page, 'param-tauM', 20);
  await slider(page, 'param-theta', 20);
  await page.getByTestId('stimulus-preset-hbar').click();
  const s1 = await run(page, 200);
  expect(s1.t).toBe(200); // no reset on param/stimulus change (FR-UI-16)
  await page.getByTestId('neuron-L4E-0').click();
  for (const id of ['neuron-L4E-1', 'neuron-L4E-2', 'neuron-L23E-0']) await page.getByTestId(id).click({ modifiers: ['Shift'] });
  expect((await state(page)).selection).toHaveLength(3); // FR-UI-13
  await page.getByTestId('btn-ask-jev').click();
  await expect(page.getByTestId('jev-log-entry')).not.toHaveCount(0);
  const nBefore = await page.getByTestId('jev-log-entry').count();
  await page.getByTestId('btn-reset').click();
  const s2 = await state(page);
  expect(s2.t).toBe(0);
  expect(s2.selection).toHaveLength(3);
  await expect(page.getByTestId('param-tauM')).toHaveValue('20');
  await expect(page.getByTestId('param-theta')).toHaveValue('20');
  await expect(page.getByTestId('stimulus-preset-hbar')).toHaveAttribute('aria-pressed', 'true');
  expect(s2.budget).toEqual({ used: 0, cap: 50 });
  await expect(page.getByTestId('jev-log-entry')).toHaveCount(nBefore);
  await expect(page.getByTestId('jev-log')).toContainText('— reset —');
  await expect(page).toHaveURL(/seed=42(&|$)/);
  expect(bad).toEqual([]);
});

test('E33b LIVE export recording validates', async ({ page }, info) => {
  const bad = watch(page);
  await open(page, `${MOCK}/${Q}`);
  await expect(page.getByTestId('mode-select-live')).toBeEnabled();
  await page.getByTestId('mode-select-live').click();
  await expect(page.getByTestId('mode-badge')).toHaveText('LIVE JEV');
  await page.getByTestId('btn-ask-jev').click();
  await expect(page.getByTestId('jev-log-entry').filter({ hasText: / · ok · / })).toHaveCount(1);
  const dl = page.waitForEvent('download');
  await page.getByTestId('btn-export-recording').click();
  const file = info.outputPath('rec.json');
  await (await dl).saveAs(file);
  const v = validateRecording(JSON.parse(fs.readFileSync(file, 'utf8')));
  expect(v.ok).toBe(true);
  expect(bad).toEqual([]);
});
