import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { tid, goLive, waitLog } from './helpers-a.mjs';

// FR-TST-05: billed. Only with JEV_LIVE_TEST=1 + TYPESAFE_API_KEY. Own proxy on 8791; key never typed into the page. 1 billed call.
test.skip(!(process.env.JEV_LIVE_TEST === '1' && process.env.TYPESAFE_API_KEY), 'needs JEV_LIVE_TEST=1 and TYPESAFE_API_KEY');
test.use({ baseURL: 'http://127.0.0.1:8791' });

let proc;
test.beforeAll(async () => {
  proc = spawn(process.execPath, ['tools/jev-proxy.mjs', '--port', '8791'], { env: process.env, stdio: 'pipe' });
  await new Promise((res, rej) => { proc.stdout.on('data', (d) => /listening/.test(String(d)) && res()); proc.once('error', rej); setTimeout(() => rej(new Error('proxy start timeout')), 10000); });
});
test.afterAll(() => proc?.kill());

test('live real: one Ask JEV ok', async ({ page }) => {
  await page.goto('/?test=1&autoplay=0&seed=42');
  await goLive(page);
  await tid(page, 'param-autoJev').uncheck();
  await page.evaluate(() => window.__mc.runSteps(1000));
  await tid(page, 'btn-ask-jev').click();
  await waitLog(page, 0, 30000);
  await expect(tid(page, 'jev-log-entry').first()).toContainText('ok');
});
