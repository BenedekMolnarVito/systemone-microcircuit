// JEV client (SPEC 3.2, 3.3, 3.7, 3.9). DOM-free; fetch/timers/clock injected. The API URL is a constant (FR-KEY-01).
import { validateResponse } from './schema.js';
import { findMatch } from './replay.js';
import { emulate as defaultEmulate } from './emulator.js';

const API = 'api/jev';
const HEALTH = 'api/health';
const TIMEOUT_MS = 6000;
const DELAYS = [1000, 2000];
const SIM_LATENCY_MS = 270;

// proxy error.code -> [client code, retry] (SPEC 3.7)
const PROXY = {
  bad_request: ['bad_request', false], no_key: ['no_key', false], unauthorized: ['unauthorized', false],
  forbidden: ['forbidden', false], bad_origin: ['bad_request', false], too_large: ['bad_request', false],
  bad_content_type: ['bad_request', false], bad_host: ['bad_request', false], upstream_rejected: ['bad_request', false],
  upstream_rate_limited: ['rate_limited', true], rate_limited: ['rate_limited', false],
  budget_exhausted: ['budget_exhausted', false], upstream_overloaded: ['overloaded', true],
  network: ['network', true], timeout: ['timeout', false], upstream_malformed: ['malformed', false],
};

export function classifyError(httpStatus, body, thrown) {
  if (thrown) {
    if (thrown.name === 'AbortError') return { code: 'timeout', retry: false };
    return { code: thrown instanceof TypeError ? 'proxy_unreachable' : 'malformed', retry: false };
  }
  const row = PROXY[body?.error?.code];
  return row ? { code: row[0], retry: row[1] } : { code: 'malformed', retry: false };
}

// Key goes only to same-origin /api/jev (FR-KEY-01).
export function canSendKey(url) {
  try {
    const loc = globalThis.location;
    const u = new URL(url, loc.href);
    return u.origin === loc.origin && u.pathname.endsWith('/api/jev');
  } catch { return false; }
}

export function createJevClient({
  mode = 'SIMULATED', fetchImpl, emulator = defaultEmulate, replay = null, keystore, bus,
  now = () => Date.now(), setTimeout: st = globalThis.setTimeout, clearTimeout: ct = globalThis.clearTimeout,
  getSeed = () => 0,
} = {}) {
  let callIndex = 0, nextId = 0, selToken = 0, fails = 0, lastLiveAt = -Infinity, flight = null, keySource = null;
  const budget = { used: 0, cap: 50 };
  const doFetch = (...a) => (fetchImpl ?? globalThis.fetch)(...a);
  const emit = (evt, p) => bus?.emit(evt, p);
  // rejects with AbortError as soon as signal aborts, even if a fake fetch ignores it
  const abortable = (signal, p) => new Promise((res, rej) => {
    const err = () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (signal.aborted) return err();
    signal.addEventListener('abort', err, { once: true });
    p.then(res, rej);
  });
  const emulateNow = (request) => emulator(request, { seed: getSeed(), callIndex: callIndex++ });
  const redact = (s) => { const k = keystore?.get(); return String(s ?? '').split(k || '\0').join('[REDACTED]').slice(0, 200); };

  const client = {
    get mode() { return mode; },
    get callIndex() { return callIndex; },
    get inFlight() { return flight !== null; },
    budget,
    liveMinIntervalMs: 2000,
    skipped: 0,
    setReplay(rec) { replay = rec; },
    setBudgetCap(n) { budget.cap = n; },
    setMode(m) {
      selToken++;
      if (flight && m !== 'LIVE') client.abortAll('mode changed');
      mode = m;
    },
    abortAll(reason) {
      if (!flight) return;
      flight.aborted = true;
      flight.reason = reason;
      flight.ctrl.abort();
    },
    resetRun() { client.abortAll('reset'); callIndex = 0; fails = 0; },

    async health() {
      const tok = selToken;
      const ctrl = new AbortController();
      const timer = st(() => ctrl.abort(), 1500);
      let h = null;
      try {
        const res = await abortable(ctrl.signal, doFetch(HEALTH, { cache: 'no-store', signal: ctrl.signal }));
        if (res.status === 200 && /json/i.test(res.headers?.get?.('content-type') || '')) {
          const b = await abortable(ctrl.signal, res.json());
          if (b && b.ok === true && ['env', 'none', 'mock'].includes(b.keySource) && typeof b.model === 'string'
            && Number.isInteger(b.budget?.used) && Number.isInteger(b.budget?.cap)
            && typeof b.mock === 'boolean' && typeof b.recording === 'boolean') h = b;
        }
      } catch { /* silent (FR-JEV-05) */ } finally { ct(timer); }
      if (tok !== selToken) return null; // selection changed meanwhile: ignore
      keySource = h ? h.keySource : null;
      return h;
    },

    ask(kind, request, simTimeMs) {
      const id = nextId++;
      emit('jev:request', { id, kind, mode, request });
      if (mode === 'LIVE') return live(id, kind, request);
      if (mode === 'REPLAY') {
        const m = replay && findMatch(replay, request);
        const v = m && validateResponse(request, m.entry.response); // FR-REC-05
        if (v?.ok) return finish(id, { ok: true, mode, status: m.kind, latencyMs: m.entry.latencyMs, response: v.response });
        return finish(id, { ok: true, mode, status: 'unrecorded', latencyMs: SIM_LATENCY_MS, response: emulateNow(request) });
      }
      return finish(id, { ok: true, mode, status: 'ok', latencyMs: SIM_LATENCY_MS, response: emulateNow(request) });
    },
  };

  function finish(id, result) {
    if (result.error) emit('jev:error', { id, code: result.error.code, message: result.error.message });
    if (result.status !== 'aborted') emit('jev:response', { id, result });
    return result;
  }

  function switchToSim(level, text) {
    emit('banner', { level, text });
    if (mode === 'SIMULATED') return;
    client.setMode('SIMULATED');
    emit('mode:changed', { mode: 'SIMULATED' });
  }

  async function live(id, kind, request) {
    if (flight || (kind === 'circuit' && now() - lastLiveAt < client.liveMinIntervalMs)) {
      client.skipped++;
      return { ok: false, mode: 'LIVE', status: 'skipped', latencyMs: 0, error: { code: 'skipped', message: 'LIVE tick skipped' } };
    }
    const f = flight = { ctrl: new AbortController(), aborted: false, timedOut: false };
    const t0 = lastLiveAt = now();
    let err = null, response = null;
    try {
      for (let a = 0; ; a++) {
        if (budget.used >= budget.cap) { err = { code: 'budget_exhausted', message: 'JEV budget reached' }; break; }
        budget.used++;
        const headers = { 'Content-Type': 'application/json' };
        if (keySource === 'none' && keystore?.get() && canSendKey(API)) headers['X-JEV-Key'] = keystore.get();
        const timer = st(() => { f.timedOut = true; f.ctrl.abort(); }, TIMEOUT_MS);
        let res = null, body = null, thrown = null;
        try {
          res = await abortable(f.ctrl.signal, doFetch(API, { method: 'POST', headers, body: JSON.stringify(request), signal: f.ctrl.signal }));
          body = await abortable(f.ctrl.signal, res.json());
        } catch (e) { thrown = e; } finally { ct(timer); }
        if (f.aborted) { err = { code: 'aborted', message: String(f.reason) }; break; }
        if (!thrown && res.status === 200) {
          const v = validateResponse(request, body);
          if (v.ok) { response = v.response; break; }
          err = { code: 'malformed', message: redact(v.reason) };
          break;
        }
        const c = classifyError(res?.status ?? null, body, thrown);
        err = { code: c.code, message: redact(body?.error?.message ?? thrown?.message ?? c.code) };
        if (!c.retry || a >= DELAYS.length) break;
        const h = res?.headers;
        const ms = Number(h?.get?.('retry-after-ms'));
        const s = Number(h?.get?.('retry-after'));
        const ra = ms > 0 ? ms : s > 0 ? s * 1000 : 0;
        if (ra > 10000) break;
        emit('banner', { level: 'warn', text: c.code === 'overloaded' ? 'JEV overloaded — retrying' : 'JEV rate limit — retrying' });
        try { await abortable(f.ctrl.signal, new Promise((r) => st(r, Math.max(DELAYS[a], ra)))); } catch {
          err = { code: 'aborted', message: String(f.reason) };
          break;
        }
      }
    } finally { flight = null; }
    const latencyMs = now() - t0;
    if (f.aborted) return finish(id, { ok: false, mode: 'LIVE', status: 'aborted', latencyMs, error: { code: 'aborted', message: String(f.reason) } });
    if (response) { fails = 0; return finish(id, { ok: true, mode: 'LIVE', status: 'ok', latencyMs, response }); }

    const code = err.code;
    if (code === 'budget_exhausted') {
      switchToSim('warn', `JEV budget reached (${budget.cap}/${budget.cap}). Continuing in SIMULATED mode.`);
      return finish(id, { ok: false, mode: 'LIVE', status: 'error:budget_exhausted', latencyMs, error: err });
    }
    if (code === 'unauthorized') {
      if (keySource !== 'env') keystore?.markInvalid();
      switchToSim('error', keySource === 'env'
        ? "The proxy's TYPESAFE_API_KEY was rejected (401) — fix it and restart the proxy"
        : 'JEV rejected the key (401)');
    } else if (code === 'forbidden') switchToSim('error', 'No key reached JEV (403)');
    else if (code === 'proxy_unreachable') switchToSim('error', 'Lost connection to the local proxy');
    else if (code === 'no_key') emit('banner', { level: 'info', text: 'Paste a JEV key or set TYPESAFE_API_KEY for the proxy' });
    if (++fails >= 3) switchToSim('error', `JEV failed 3 times in a row (last: ${code}). Continuing in SIMULATED mode.`);
    if (kind !== 'circuit') return finish(id, { ok: false, mode: 'LIVE', status: `error:${code}`, latencyMs, error: err });
    return finish(id, { ok: true, mode: 'LIVE', status: `fallback:${code}`, latencyMs, response: emulateNow(request), error: err });
  }

  return client;
}
