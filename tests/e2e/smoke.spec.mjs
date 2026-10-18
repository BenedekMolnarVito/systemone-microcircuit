import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { watch, MOCK } from './helpers-a.mjs';

// FR-TST-12(b): replays browser-scenarios/*.json (jev-browser format) with Playwright.
const DIR = 'browser-scenarios';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

for (const f of files) {
  const sc = JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8'));
  test(`smoke ${sc.name}`, async ({ page, baseURL }) => {
    const base = sc.server === 'mock' ? MOCK : baseURL;
    const errors = watch(page);
    await page.goto(new URL(sc.startUrl, base + '/').href);
    const by = (t) => page.getByTestId(t.testid);
    for (const s of sc.steps) {
      if (s.op === 'click') await by(s.target).click();
      else if (s.op === 'type') await by(s.target).fill(sc.inputs[s.input]);
      else if (s.op === 'press') await page.keyboard.press(s.key);
      else if (s.op === 'js') await page.evaluate(s.js);
      else if (s.op === 'wait_for') await (s.testid ? page.getByTestId(s.testid) : page.getByText(s.text)).first().waitFor();
      else throw new Error(`unsupported op ${s.op}`);
    }
    for (const a of sc.assertions) {
      if (a.type === 'js') await expect.poll(() => page.evaluate(a.js), { timeout: 5000, intervals: [100] }).toBe(true);
      else if (a.type === 'text_contains') await expect.poll(() => page.locator('body').innerText(), { timeout: 5000, intervals: [100] }).toContain(a.text);
      else if (a.type === 'console_errors_max') expect(errors.length).toBeLessThanOrEqual(a.max);
      else throw new Error(`unsupported assertion ${a.type}`);
    }
  });
}
