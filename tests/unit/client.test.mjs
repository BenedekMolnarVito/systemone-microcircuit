import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJevClient, classifyError, canSendKey } from '../../docs/js/jev/client.js';
import { createKeystore } from '../../docs/js/jev/keystore.js';
import { circuitRequest } from '../../docs/js/jev/schema.js';
import { emulate } from '../../docs/js/jev/emulator.js';
import { buildRecordingEntry, buildRecording } from '../../docs/js/jev/replay.js';
import { createBus } from '../../docs/js/ui/bus.js';

const STATE = {
  kind: 'circuit_summary', description: 'd', simTimeMs: 1500, windowMs: 500, stimulus: 'vbar',
  l4_rates_hz: { vertical: 34.5, horizontal: 2.1, diag45: 6, diag135: 5.2 },
  l23_rates_hz: { vertical: 28, horizontal: 1.2, diag45: 3.9, diag135: 3.1 },
  l5_rates_hz: { vertical: 19.5, horizontal: 0, diag45: 2.5, diag135: 0 },
  inhibitory_rates_hz: { pv: 22.1, sst: 9.8, vip: 7.5 },
  prev_l4_rates_hz: { vertical: 1, horizontal: 0.8, diag45: 1.1, diag135: 0.9 }, local_readout: 'vertical',
};
const REQ = circuitRequest(STATE);
const GOOD = emulate(REQ, { seed: 1, callIndex: 0 });

const resp = (status, body, h = {}) => ({ status, headers: { get: (k) => h[k.toLowerCase()] ?? null }, json: async () => body });
const err = (code) => ({ error: { code, message: 'x' } });
const flush = () => new Promise((r) => setImmediate(r));
const memStorage = () => ({ session: { getItem: () => null, setItem() {}, removeItem() {} }, local: { getItem: () => null, setItem() {}, removeItem() {} } });

function fakeTimers() {
  const rec = [], pend = new Map();
  let id = 0;
  return {
    rec,
    st: (fn, ms) => { const i = ++id; rec.push(ms); if (ms === 6000 || ms === 1500) pend.set(i, fn); else queueMicrotask(fn); return i; },
    ct: (i) => { pend.delete(i); },
    fire: () => { for (const [i, fn] of [...pend]) { pend.delete(i); fn(); } },
  };
}

function make(fetchImpl, extra = {}) {
  const t = fakeTimers(), bus = createBus(), events = [];
  for (const e of ['jev:request', 'jev:response', 'jev:error', 'banner', 'mode:changed']) bus.on(e, (p) => events.push([e, p]));
  const client = createJevClient({ mode: 'LIVE', fetchImpl, bus, setTimeout: t.st, clearTimeout: t.ct, ...extra });
  client.liveMinIntervalMs = 0;
  return { client, t, events };
}
const never = () => new Promise(() => {});
// every jev:request gets exactly one jev:response or jev:error (dashboard/jev-log contract)
const oneEach = (events) => {
  const ids = (names) => events.filter(([e]) => names.includes(e)).map(([, p]) => p.id).sort();
  assert.deepEqual(ids(['jev:response', 'jev:error']), ids(['jev:request']));
};

// FR-JEV-13 "When used == cap: switch to SIMULATED" → switch right after the cap-reaching call, not on the next attempt.
test('U-44 budget cap 2: SIMULATED once used == cap; a further LIVE ask is budget_exhausted without fetch', async () => {
  let n = 0;
  const { client, events } = make(async () => { n++; return resp(200, GOOD); });
  client.setBudgetCap(2);
  assert.equal((await client.ask('circuit', REQ, 0)).status, 'ok');
  assert.equal(client.mode, 'LIVE');
  const second = await client.ask('circuit', REQ, 0);
  assert.equal(second.status, 'ok');
  assert.equal(second.mode, 'LIVE');
  assert.equal(client.mode, 'SIMULATED');
  assert.ok(events.some(([e, p]) => e === 'banner' && p.level === 'warn' && p.text === 'JEV budget reached (2/2). Continuing in SIMULATED mode.'));
  assert.ok(events.some(([e, p]) => e === 'mode:changed' && p.mode === 'SIMULATED'));
  client.setMode('LIVE');
  const r = await client.ask('circuit', REQ, 0);
  assert.equal(r.error.code, 'budget_exhausted');
  assert.equal(n, 2);
  assert.equal(client.mode, 'SIMULATED');
  assert.equal(client.budget.used, 2);
  oneEach(events);
});

test('U-45 health returns null for HTML / 404 / missing keySource / reject', async () => {
  const good = { ok: true, keySource: 'mock', model: 'm', budget: { used: 0, cap: 5 }, mock: true, recording: false };
  const j = { 'content-type': 'application/json' };
  const cases = [
    async () => resp(200, good, { 'content-type': 'text/html' }),
    async () => resp(404, good, j),
    async () => resp(200, { ...good, keySource: undefined }, j),
    async () => { throw new TypeError('down'); },
  ];
  for (const f of cases) assert.equal(await make(f).client.health(), null);
  assert.deepEqual(await make(async () => resp(200, good, j)).client.health(), good);
});

test('U-46 timeout at 6000 ms; 3 consecutive -> SIMULATED', async () => {
  const { client, t, events } = make(never);
  for (let i = 0; i < 3; i++) {
    const p = client.ask('circuit', REQ, 0);
    await flush();
    assert.equal(client.inFlight, true);
    t.fire();
    const r = await p;
    assert.equal(r.status, 'fallback:timeout');
    assert.equal(r.ok, true);
  }
  assert.ok(t.rec.includes(6000));
  assert.equal(client.mode, 'SIMULATED');
  assert.ok(events.some(([e, p]) => e === 'mode:changed' && p.mode === 'SIMULATED'));
});

test('U-47 retries upstream_rate_limited twice with 1000/2000 ms; budget 3', async () => {
  const seq = [resp(429, err('upstream_rate_limited')), resp(429, err('upstream_rate_limited')), resp(200, GOOD)];
  const { client, t } = make(async () => seq.shift());
  const r = await client.ask('circuit', REQ, 0);
  assert.equal(r.status, 'ok');
  assert.deepEqual(t.rec.filter((x) => x !== 6000), [1000, 2000]);
  assert.equal(client.budget.used, 3);
});

test('U-47 proxy rate_limited: no retry, tick fallback', async () => {
  let n = 0;
  const { client } = make(async () => { n++; return resp(429, err('rate_limited')); });
  const r = await client.ask('circuit', REQ, 0);
  assert.equal(r.status, 'fallback:rate_limited');
  assert.equal(n, 1);
});

test('U-47 Retry-After 5 -> 5000 ms; 30 -> no retry', async () => {
  const seq = [resp(429, err('upstream_rate_limited'), { 'retry-after': '5' }), resp(200, GOOD)];
  const a = make(async () => seq.shift());
  assert.equal((await a.client.ask('circuit', REQ, 0)).status, 'ok');
  assert.deepEqual(a.t.rec.filter((x) => x !== 6000), [5000]);
  let n = 0;
  const b = make(async () => { n++; return resp(429, err('upstream_rate_limited'), { 'retry-after': '30' }); });
  assert.equal((await b.client.ask('circuit', REQ, 0)).status, 'fallback:rate_limited');
  assert.equal(n, 1);
});

test('U-48 abortAll during flight -> aborted, no jev:response; late resolution ignored', async () => {
  let release;
  const { client, events } = make(() => new Promise((r) => { release = () => r(resp(200, GOOD)); }));
  const p = client.ask('circuit', REQ, 0);
  await flush();
  client.abortAll('test');
  const r = await p;
  assert.equal(r.status, 'aborted');
  release();
  await flush();
  assert.ok(!events.some(([e]) => e === 'jev:response'));
  assert.ok(events.some(([e, x]) => e === 'jev:error' && x.code === 'aborted'));
  assert.equal(client.inFlight, false);
  oneEach(events);
});

test('U-49 setMode(SIMULATED) during flight aborts; next ask is sync emulator', async () => {
  const { client } = make(never);
  const p = client.ask('circuit', REQ, 0);
  await flush();
  client.setMode('SIMULATED');
  assert.equal((await p).status, 'aborted');
  const r = client.ask('circuit', REQ, 0);
  assert.equal(typeof r.then, 'undefined');
  assert.equal(r.mode, 'SIMULATED');
  assert.equal(r.latencyMs, 270);
  assert.deepEqual(r.response.answers, emulate(REQ, { seed: 0, callIndex: 0 }).answers);
  assert.equal(client.callIndex, 1);
  client.resetRun();
  assert.equal(client.callIndex, 0);
});

function withLocation(href, fn) {
  const old = globalThis.location;
  globalThis.location = new URL(href);
  return Promise.resolve(fn()).finally(() => { globalThis.location = old; });
}
const HEALTH = (keySource) => resp(200, { ok: true, keySource, model: 'm', budget: { used: 0, cap: 5 }, mock: keySource === 'mock', recording: false }, { 'content-type': 'application/json' });

test('U-52 X-JEV-Key only with keySource none; URL is api/jev', () => withLocation('https://h.example/systemone-microcircuit/', async () => {
  for (const [ks, expectKey] of [['env', false], ['mock', false], ['none', true]]) {
    const calls = [];
    const keystore = createKeystore(memStorage());
    keystore.enable();
    keystore.set('FAKEkey123456', false);
    const { client } = make(async (url, init) => {
      calls.push([url, init]);
      return url === 'api/health' ? HEALTH(ks) : resp(200, GOOD);
    }, { keystore });
    await client.health();
    await client.ask('circuit', REQ, 0);
    const [url, init] = calls[1];
    assert.equal(url, 'api/jev');
    assert.equal('X-JEV-Key' in init.headers, expectKey);
    if (expectKey) assert.equal(init.headers['X-JEV-Key'], 'FAKEkey123456');
  }
}));

test('U-53 same-origin only; ?api= ignored; cross-origin never gets key', () => withLocation('https://benedekmolnarvito.github.io/systemone-microcircuit/?api=https://evil.example', async () => {
  const urls = [];
  const { client } = make(async (url) => { urls.push(url); return resp(200, GOOD); });
  await client.ask('circuit', REQ, 0);
  assert.deepEqual(urls, ['api/jev']);
  assert.equal(canSendKey('api/jev'), true);
  assert.equal(canSendKey('https://evil.example/api/jev'), false);
  assert.equal(canSendKey('api/other'), false);
}));

test('U-54 classifyError table', () => {
  const rows = [
    ['bad_request', 'bad_request', false], ['no_key', 'no_key', false], ['unauthorized', 'unauthorized', false],
    ['forbidden', 'forbidden', false], ['bad_origin', 'bad_request', false], ['too_large', 'bad_request', false],
    ['bad_content_type', 'bad_request', false], ['bad_host', 'bad_request', false], ['upstream_rejected', 'bad_request', false],
    ['upstream_rate_limited', 'rate_limited', true], ['rate_limited', 'rate_limited', false],
    ['budget_exhausted', 'budget_exhausted', false], ['upstream_overloaded', 'overloaded', true],
    ['network', 'network', true], ['timeout', 'timeout', false], ['upstream_malformed', 'malformed', false],
  ];
  for (const [pc, code, retry] of rows) assert.deepEqual(classifyError(400, err(pc)), { code, retry }, pc);
  assert.deepEqual(classifyError(500, { nope: 1 }), { code: 'malformed', retry: false });
  assert.deepEqual(classifyError(null, null, new TypeError('x')), { code: 'proxy_unreachable', retry: false });
  assert.deepEqual(classifyError(null, null, Object.assign(new Error(), { name: 'AbortError' })), { code: 'timeout', retry: false });
});

test('U-54 3 consecutive bad_request -> fallback statuses then SIMULATED', async () => {
  const { client, events } = make(async () => resp(400, err('bad_request')));
  const out = [];
  for (let i = 0; i < 3; i++) out.push(await client.ask('circuit', REQ, 0));
  assert.deepEqual(out.map((r) => r.status), Array(3).fill('fallback:bad_request'));
  assert.ok(out.every((r) => r.response));
  assert.equal(client.mode, 'SIMULATED');
  assert.ok(events.some(([e, p]) => e === 'banner' && p.text === 'JEV rejected the request format')); // §3.7
  // fallback/error results are one jev:response each, never an extra jev:error (FR-JEV-14, §3.7 closed status set)
  assert.equal(events.filter(([e]) => e === 'jev:error').length, 0);
  assert.equal(events.filter(([e]) => e === 'jev:response').length, 3);
  oneEach(events);
});

test('neuron LIVE error -> single jev:response with status error:<code>', async () => {
  const { client, events } = make(async () => resp(401, err('no_key')));
  const r = await client.ask('neuron', REQ, 0);
  assert.equal(r.status, 'error:no_key');
  assert.deepEqual(events.filter(([e]) => e.startsWith('jev:')).map(([e]) => e), ['jev:request', 'jev:response']);
});

test('unauthorized: key marked invalid, SIMULATED; malformed 200 -> fallback:malformed', async () => {
  const keystore = createKeystore(memStorage());
  keystore.enable(); keystore.set('FAKEkey123456', false);
  const a = make(async () => resp(401, err('unauthorized')), { keystore });
  assert.equal((await a.client.ask('circuit', REQ, 0)).status, 'fallback:unauthorized');
  assert.equal(a.client.mode, 'SIMULATED');
  assert.equal(keystore.isInvalid(), true);
  const b = make(async () => resp(200, { answers: {} }));
  assert.equal((await b.client.ask('circuit', REQ, 0)).status, 'fallback:malformed');
});

test('skips when inside liveMinIntervalMs; budget untouched; skipped ticks emit no events', async () => {
  let t0 = 0;
  const { client, events } = make(async () => resp(200, GOOD), { now: () => t0 });
  client.liveMinIntervalMs = 2000;
  assert.equal((await client.ask('circuit', REQ, 0)).status, 'ok');
  t0 = 1000;
  assert.equal((await client.ask('circuit', REQ, 0)).status, 'skipped');
  assert.equal(client.skipped, 1);
  t0 = 2500;
  assert.equal((await client.ask('circuit', REQ, 0)).status, 'ok');
  assert.equal(client.budget.used, 2);
  // C1: a skipped tick must not leave a dangling jev:request (would keep btn-ask-jev disabled forever)
  assert.equal(events.filter(([e]) => e === 'jev:request').length, 2);
  oneEach(events);
});

test('skip while in flight emits nothing; in-flight request still resolves once', async () => {
  let release;
  const { client, events } = make(() => new Promise((r) => { release = () => r(resp(200, GOOD)); }));
  const p = client.ask('circuit', REQ, 0);
  await flush();
  assert.equal(client.ask('neuron', REQ, 0).status, 'skipped');
  release();
  assert.equal((await p).status, 'ok');
  assert.equal(client.skipped, 1);
  oneEach(events);
  assert.equal(events.filter(([e]) => e === 'jev:request').length, 1);
});

test('U-55 health race: switch away before resolve -> ignored', async () => {
  let release;
  const { client } = make(() => new Promise((r) => { release = () => r(HEALTH('mock')); }));
  client.setMode('LIVE');
  const p = client.health();
  await flush();
  client.setMode('SIMULATED');
  release();
  assert.equal(await p, null);
  assert.equal(client.mode, 'SIMULATED');
});

test('REPLAY: exact hit (validated, no callIndex), else unrecorded via emulator', () => {
  const entry = buildRecordingEntry(0, 1500, REQ, GOOD, 321);
  const rec = buildRecording({}, [entry]);
  const client = createJevClient({ mode: 'REPLAY', replay: rec });
  const hit = client.ask('circuit', REQ, 0);
  assert.equal(hit.status, 'exact');
  assert.equal(hit.latencyMs, 321);
  assert.equal(client.callIndex, 0);
  const miss = client.ask('circuit', circuitRequest({ ...STATE, stimulus: 'hbar' }), 0);
  assert.equal(miss.status, 'unrecorded');
  assert.equal(client.callIndex, 1);
  // an invalid recorded response is not trusted (FR-REC-05)
  const bad = buildRecording({}, [{ ...entry, response: { answers: { circuit_evidence: { type: 'noul', noul: 0.5 } } } }]);
  assert.equal(createJevClient({ mode: 'REPLAY', replay: bad }).ask('circuit', REQ, 0).status, 'unrecorded');
});
