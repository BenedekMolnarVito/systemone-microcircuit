import { test, expect } from '@playwright/test';
import { SHOT, tid, watch, open } from './helpers-a.mjs';

// Contrast of 5 sampled elements against their effective (first opaque ancestor) background.
async function contrast(page) {
  return page.evaluate(() => {
    const ids = ['app-title', 'pitch', 'btn-play', 'readout-panel', 'sim-time'];
    const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const bgOf = (el) => { for (; el; el = el.parentElement) { const c = parse(getComputedStyle(el).backgroundColor); if (c.a > 0.99) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
    return ids.map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      const fg = parse(getComputedStyle(el).color), bg = bgOf(el);
      const [a, b] = [L(fg), L(bg)].sort((x, y) => y - x);
      return { id, ratio: (a + 0.05) / (b + 0.05) };
    });
  });
}
const bgVar = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase());

for (const [id, scheme, bg] of [['E10-dark', 'dark', '#0b0f17'], ['E11-light', 'light', '#f6f8fb']]) {
  test.describe(id, () => {
    test.use({ colorScheme: scheme });
    test(id, async ({ page }) => {
      const errs = watch(page);
      await open(page);
      expect(await bgVar(page)).toBe(bg);
      for (const c of await contrast(page)) expect(c.ratio, c.id).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: SHOT(id), animations: 'disabled' });
      expect(errs).toEqual([]);
    });
  });
}

test('E13 about', async ({ page }) => {
  const errs = watch(page);
  await open(page);
  await tid(page, 'btn-about').click();
  const norm = (s) => s.replace(/\s+/g, ' ');
  for (const id of ['about-summary', 'about-pitch', 'about-mapping', 'about-primitives', 'about-established', 'about-proposal', 'about-modes', 'about-simplification', 'about-refs']) {
    await expect(tid(page, id)).toBeVisible();
    expect((await tid(page, id).innerText()).trim().length, id).toBeGreaterThan(20);
  }
  const prop = norm(await tid(page, 'about-proposal').innerText());
  expect(prop).toContain('Noul is a probability; spike is a Bernoulli sample of the per-step hazard derived from it.');
  expect(prop).toContain('Spiking neurons, leaky graded potentials, dendritic computation, interneuron motifs and STDP are established neuroscience. What is original here is the owner\'s proposal');
  expect(norm(await tid(page, 'about-simplification').innerText())).toContain('In SIMULATED mode the JEV answers are computed by a simple local formula from L4 firing rates, not by the JEV model. Agreement in this mode shows the plumbing, not JEV\'s judgement. REPLAY and LIVE show genuine JEV answers.');
  await page.screenshot({ path: SHOT('E13-about'), animations: 'disabled' });
  expect(errs).toEqual([]);
});
