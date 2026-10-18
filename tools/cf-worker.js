// Optional Cloudflare Worker template (SPEC 5.7, FR-PRX-17). Presenters only; not deployed or wired into the page.
//
// Deploying this spends YOUR JEV credits for ANYONE on the internet: the Origin allowlist only stops browsers on other sites, not scripts. Keep the allowlist minimal, configure a Cloudflare rate-limiting rule (for example 10 requests/min per IP) and a daily spend cap or alert; the per-isolate BUDGET is not a global cap. Delete the Worker after the demo.
//
// Bindings: secret TYPESAFE_API_KEY (never in code); vars ALLOWED_ORIGINS (comma-separated exact origins),
// BUDGET (default 100, per isolate), TYPESAFE_BASE_URL (optional); ASSETS (optional, serves a copy of docs/ same-origin).
// Any X-JEV-Key header is ignored; /api/health always reports keySource "env".

const MODELS = ['jev-latest', 'jev-1.13.0', 'jev-1.14.0', 'jev-preview'];
const TYPES = ['noul', 'choice', 'score'];
const MAX_BODY = 32768;
let used = 0; // shortcut: per-isolate counter, not a global cap; use a rate-limiting rule for that

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});
const fail = (status, code, message, headers) => json(status, { error: { code, message: String(message).slice(0, 200) } }, headers);

// Copy of FR-PRX-08 request validation (no imports).
function checkRequest(b) {
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(b) || Object.keys(b).sort().join() !== 'model,questions,state') return 'exactly keys state, model, questions';
  if (!MODELS.includes(b.model)) return 'unknown model';
  if (!isObj(b.state) || JSON.stringify(b.state).length > 16384) return 'bad or too large state';
  if (!isObj(b.questions)) return 'questions must be an object';
  const qs = Object.values(b.questions);
  if (qs.length < 1 || qs.length > 8) return '1-8 questions required';
  for (const q of qs) {
    if (!isObj(q) || !TYPES.includes(q.type)) return 'bad question type';
    if (typeof q.instructions !== 'string' || q.instructions.length > 1000) return 'bad instructions';
    if (q.type === 'choice') {
      const n = isObj(q.criteria) ? Object.keys(q.criteria).length : 0;
      if (n < 2 || n > 255) return 'choice needs 2-255 options';
    }
    if (q.type === 'score' && !(Array.isArray(q.criteria) && q.criteria.length >= 2 && q.criteria.length <= 10 && q.criteria.every((c) => typeof c === 'string'))) return 'score needs 2-10 string criteria';
  }
  return null;
}

function mapStatus(s) {
  if (s === 401) return [401, 'unauthorized'];
  if (s === 403) return [403, 'forbidden'];
  if (s === 400 || s === 422) return [s, 'upstream_rejected'];
  if (s === 429) return [429, 'upstream_rate_limited'];
  if (s === 529 || s === 502 || s === 503) return [503, 'upstream_overloaded'];
  return [502, 'upstream_malformed'];
}

async function handleJev(request, env) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return fail(415, 'bad_content_type', 'Content-Type must be application/json');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('origin');
  if (!origin || !allowed.includes(origin)) return fail(403, 'bad_origin', 'Origin not allowed');
  const text = await request.text();
  if (text.length > MAX_BODY) return fail(413, 'too_large', 'Body exceeds 32768 bytes');
  let body;
  try { body = JSON.parse(text); } catch { return fail(400, 'bad_request', 'Invalid JSON'); }
  const bad = checkRequest(body);
  if (bad) return fail(400, 'bad_request', bad);
  const key = env.TYPESAFE_API_KEY;
  if (!key) return fail(401, 'no_key', 'Worker secret TYPESAFE_API_KEY is not set.');
  const cap = Number(env.BUDGET) || 100;
  if (used >= cap) return fail(429, 'budget_exhausted', `Budget of ${cap} upstream calls used`);
  used++;
  const base = (env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai').replace(/\/+$/, '');
  if (!base.startsWith('https://')) return fail(500, 'internal', 'TYPESAFE_BASE_URL must start with https://');
  let r;
  let parsed = null;
  try {
    r = await fetch(base + '/v1/systemone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    try { parsed = JSON.parse(await r.text()); } catch (e) { if (e?.name === 'TimeoutError') throw e; }
  } catch (e) {
    return e?.name === 'TimeoutError' ? fail(504, 'timeout', 'Upstream timed out') : fail(502, 'network', 'Could not reach upstream');
  }
  const isObj = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
  if (r.status !== 200) {
    const [st, code] = mapStatus(r.status);
    const m = isObj ? (typeof parsed.detail?.message === 'string' ? parsed.detail.message : typeof parsed.msg === 'string' ? parsed.msg : '') : '';
    const ra = r.headers.get('retry-after');
    return fail(st, code, (m || `Upstream status ${r.status}`).split(key).join('[REDACTED]'), ra !== null && /^\d+$/.test(ra) && +ra <= 60 ? { 'Retry-After': ra } : {});
  }
  if (!isObj) return fail(502, 'upstream_malformed', 'Upstream returned non-JSON');
  return json(200, parsed);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response('Method Not Allowed', { status: 405 }); // never any CORS headers
    if (pathname === '/api/health' && request.method === 'GET') {
      return json(200, { ok: true, keySource: 'env', model: 'jev-latest', budget: { used, cap: Number(env.BUDGET) || 100 }, mock: false, recording: false });
    }
    if (pathname === '/api/jev') return request.method === 'POST' ? handleJev(request, env) : fail(405, 'bad_request', 'POST only');
    if (pathname.startsWith('/api/')) return fail(404, 'not_found', 'Not found');
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};
