// T16b helpers: console filter (FR-TST-07), __mc shortcuts, health override. Not shared with T16a.
export const MOCK = `http://127.0.0.1:${process.env.PW_MOCK_PORT || 8790}`;
export const Q = '?test=1&autoplay=0&seed=42';
export const tid = (page, id) => page.getByTestId(id);
export const NO_KEY_HEALTH = { ok: true, keySource: 'none', model: 'jev-latest', budget: { used: 0, cap: 50 }, mock: true, recording: false };

// Returns array that collects every unexpected console error / page error. allow: [{url: RegExp, text: RegExp}].
export function watch(page, allow = []) {
  const bad = [];
  page.on('pageerror', (e) => bad.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const url = msg.location().url, text = msg.text();
    if (/^Failed to load resource: the server responded with a status of 404/.test(text) && /\/api\/health$/.test(url)) return;
    if (allow.some((a) => a.url.test(url) && a.text.test(text))) return;
    bad.push(`${text} @ ${url}`);
  });
  return bad;
}

export async function open(page, url = `/${Q}`) {
  await page.goto(url);
  await page.waitForFunction(() => window.__mc);
}
export const state = (page) => page.evaluate(() => window.__mc.getState());
export const run = (page, n) => page.evaluate((k) => window.__mc.runSteps(k), n);
export const idle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
export const setSeed = (page, s) => page.evaluate((v) => window.__mc.setSeed(v), s);

// Health reports keySource none (user must paste a key), body otherwise valid.
export const routeNoKey = (page) => page.route('**/api/health', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NO_KEY_HEALTH) }));
export const slider = (page, id, v) => page.getByTestId(id).fill(String(v));
