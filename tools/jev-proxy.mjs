#!/usr/bin/env node
// Local static server + JEV proxy (SPEC 5.6). Node built-ins + shared jev modules only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateRequest, validateResponse } from '../docs/js/jev/schema.js';
import { normalizeKey } from '../docs/js/jev/keystore.js';
import { emulate } from '../docs/js/jev/emulator.js';
import { buildRecordingEntry, buildRecording } from '../docs/js/jev/replay.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODELS = ['jev-latest', 'jev-1.13.0', 'jev-1.14.0', 'jev-preview'];
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };
const SEC = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP };
const TEXT = { 'Content-Type': 'text/plain; charset=utf-8' };
const MAX_BODY = 32768;

export const redact = (str, secrets) => secrets.filter(Boolean).reduce((s, k) => s.split(k).join('[REDACTED]'), String(str));

// Upstream status -> [proxy status, code] (SPEC 3.7).
function mapStatus(s) {
  if (s === 401) return [401, 'unauthorized'];
  if (s === 403) return [403, 'forbidden'];
  if (s === 400 || s === 422) return [s, 'upstream_rejected'];
  if (s === 429) return [429, 'upstream_rate_limited'];
  if (s === 529 || s === 502 || s === 503) return [503, 'upstream_overloaded'];
  return [502, 'upstream_malformed'];
}

// Proxy-side limits beyond schema.validateRequest (FR-PRX-08).
function checkRequest(body) {
  const v = validateRequest(body);
  if (!v.ok) return v.reason;
  if (Object.keys(body).sort().join() !== 'model,questions,state') return 'exactly keys state, model, questions';
  if (!MODELS.includes(body.model)) return 'unknown model';
  if (Buffer.byteLength(JSON.stringify(body.state)) > 16384) return 'state too large';
  for (const [k, q] of Object.entries(body.questions)) {
    if (q.instructions.length > 1000) return `${k}: instructions too long`;
    if (q.type === 'choice' && Object.keys(q.criteria).length < 2) return `${k}: choice needs 2+ options`;
    if (q.type === 'score' && !q.criteria.every((c) => typeof c === 'string')) return `${k}: score criteria must be strings`;
  }
  return null;
}

export async function createProxy({ port = 8787, root, budget = 200, rate = 2, record = null, mockUpstream = false, mockStatus = null, noApi = false, env = process.env, log = console.log } = {}) {
  const base = (env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai').replace(/\/+$/, '');
  if (!/^(https:\/\/|http:\/\/127\.0\.0\.1:|http:\/\/localhost:)/.test(base)) throw new Error('TYPESAFE_BASE_URL must start with https://, http://127.0.0.1: or http://localhost:');
  const upstreamUrl = base + '/v1/systemone';
  const rootDir = fs.realpathSync(path.resolve(root ?? path.join(HERE, '..', 'docs')));
  const envKey = env.TYPESAFE_API_KEY || '';
  let used = 0;
  let callIndex = 0;
  let tokens = rate;
  let last = Date.now();
  const entries = [];
  let usageTotal = null;
  let PORT = port;

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', ...headers });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const err = (res, ctx, status, code, message, headers) => send(res, status, { error: { code, message: redact(String(message).slice(0, 200), ctx.secrets) } }, headers);

  function writeRecord(request, validated, latency) {
    entries.push(buildRecordingEntry(entries.length, request.state?.simTimeMs ?? null, request, validated, latency));
    if (validated.usage) {
      usageTotal ??= { input_tokens: 0, output_tokens: 0 };
      usageTotal.input_tokens += validated.usage.input_tokens ?? 0;
      usageTotal.output_tokens += validated.usage.output_tokens ?? 0;
    }
    const file = buildRecording({ model: validated.model, usageTotal, app: { commit: null } }, entries);
    fs.writeFileSync(record + '.tmp', JSON.stringify(file, null, 2));
    fs.renameSync(record + '.tmp', record);
  }

  function readBody(req, res, ctx) {
    return new Promise((resolve) => {
      const chunks = [];
      let n = 0;
      req.on('data', (c) => {
        n += c.length;
        if (n > MAX_BODY) {
          err(res, ctx, 413, 'too_large', 'Body exceeds 32768 bytes');
          req.destroy();
          resolve(null);
        } else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', () => resolve(null));
    });
  }

  async function handleJev(req, res, ctx) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) return err(res, ctx, 415, 'bad_content_type', 'Content-Type must be application/json');
    const origin = req.headers.origin;
    if (origin === 'null' || (origin !== undefined && origin !== `http://127.0.0.1:${PORT}` && origin !== `http://localhost:${PORT}`)) return err(res, ctx, 403, 'bad_origin', 'Origin not allowed');
    const sfs = req.headers['sec-fetch-site'];
    if (sfs === 'cross-site' || sfs === 'same-site') return err(res, ctx, 403, 'bad_origin', 'Cross-site request refused');
    const text = await readBody(req, res, ctx);
    if (text === null) return;
    let body;
    try { body = JSON.parse(text); } catch { return err(res, ctx, 400, 'bad_request', 'Invalid JSON'); }
    const bad = checkRequest(body);
    if (bad) return err(res, ctx, 400, 'bad_request', bad);
    ctx.q = Object.keys(body.questions).length;

    let key = envKey;
    if (!mockUpstream && !key) {
      const h = req.headers['x-jev-key'];
      const n = h === undefined ? null : normalizeKey(h);
      if (!n?.ok) return err(res, ctx, 401, 'no_key', 'No JEV key: set TYPESAFE_API_KEY or paste a key in the page.');
      key = n.key;
      ctx.secrets.push(key); // redact the normalised (trimmed) key too
    }
    const now = Date.now();
    tokens = Math.min(rate, tokens + ((now - last) / 1000) * rate);
    last = now;
    if (tokens < 1) return err(res, ctx, 429, 'rate_limited', 'Proxy rate limit', { 'Retry-After': '1' });
    tokens -= 1;
    if (used >= budget) return err(res, ctx, 429, 'budget_exhausted', `Budget of ${budget} upstream calls used`);
    used++;

    const t0 = Date.now();
    let upstream;
    if (mockUpstream) {
      if (mockStatus) {
        const [st, code] = mapStatus(mockStatus);
        return err(res, ctx, st, code, `mock upstream status ${mockStatus}`);
      }
      upstream = { ...emulate(body, { seed: 42, callIndex: callIndex++ }), model: 'jev-mock' };
    } else {
      let r;
      let parsed = null;
      try {
        r = await fetch(upstreamUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });
        try { parsed = JSON.parse(await r.text()); } catch (e) { if (e?.name === 'TimeoutError') throw e; }
      } catch (e) {
        return e?.name === 'TimeoutError' ? err(res, ctx, 504, 'timeout', 'Upstream timed out') : err(res, ctx, 502, 'network', 'Could not reach upstream');
      }
      const isObj = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
      if (r.status !== 200) {
        const [st, code] = mapStatus(r.status);
        const m = isObj ? (typeof parsed.detail?.message === 'string' ? parsed.detail.message : typeof parsed.msg === 'string' ? parsed.msg : '') : '';
        const ra = r.headers.get('retry-after');
        return err(res, ctx, st, code, m || `Upstream status ${r.status}`, ra !== null && /^\d+$/.test(ra) && +ra <= 60 ? { 'Retry-After': ra } : {});
      }
      if (!isObj) return err(res, ctx, 502, 'upstream_malformed', 'Upstream returned non-JSON');
      upstream = parsed;
    }
    ctx.tokensIn = upstream.usage?.input_tokens;
    if (record) {
      const v = validateResponse(body, upstream);
      if (v.ok) writeRecord(body, v.response, Date.now() - t0);
    }
    send(res, 200, upstream);
  }

  function serveStatic(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', TEXT);
    const notFound = () => send(res, 404, 'Not found', TEXT);
    let decoded;
    try { decoded = decodeURIComponent(req.url.split(/[?#]/)[0]); } catch { return notFound(); }
    if (decoded.includes('\0') || decoded.includes('\\')) return notFound();
    if (decoded === '/') decoded = '/index.html';
    let real;
    try {
      real = fs.realpathSync(path.resolve(rootDir, '.' + decoded));
      const rel = path.relative(rootDir, real);
      if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.statSync(real).isFile()) return notFound();
    } catch { return notFound(); }
    const data = fs.readFileSync(real);
    res.writeHead(200, { ...SEC, 'Content-Type': MIME[path.extname(real).toLowerCase()] || 'application/octet-stream', 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  const server = http.createServer(async (req, res) => {
    const ctx = { secrets: [envKey, req.headers['x-jev-key']], q: null, tokensIn: undefined };
    const t0 = Date.now();
    const urlPath = req.url.split(/[?#]/)[0];
    const isApi = urlPath.startsWith('/api/');
    if (isApi && !noApi) {
      res.on('finish', () => log(redact([new Date().toISOString(), req.method, urlPath, res.statusCode, `${Date.now() - t0}ms`, `q=${ctx.q ?? '-'}`, ctx.tokensIn !== undefined ? `in=${ctx.tokensIn}` : ''].filter(Boolean).join(' '), ctx.secrets)));
    }
    try {
      const host = String(req.headers.host || '').toLowerCase();
      if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return err(res, ctx, 421, 'bad_host', 'Host not allowed');
      if (req.method === 'OPTIONS') return send(res, 405, 'Method Not Allowed', TEXT);
      if (!isApi) return serveStatic(req, res);
      if (noApi) return send(res, 404, 'Not found', TEXT);
      if (urlPath === '/api/health' && req.method === 'GET') {
        return send(res, 200, { ok: true, keySource: mockUpstream ? 'mock' : envKey ? 'env' : 'none', model: 'jev-latest', budget: { used, cap: budget }, mock: mockUpstream, recording: !!record });
      }
      if (urlPath === '/api/jev') return req.method === 'POST' ? await handleJev(req, res, ctx) : err(res, ctx, 405, 'bad_request', 'POST only');
      return err(res, ctx, 404, 'not_found', 'Not found');
    } catch {
      if (!res.headersSent) err(res, ctx, 500, 'internal', 'Internal error');
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;

  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  PORT = server.address().port;
  log(`systemone-microcircuit proxy listening on http://127.0.0.1:${PORT} (key: ${mockUpstream ? 'mock' : envKey ? 'env' : 'none'}, api: ${noApi ? 'off' : 'on'}, upstream: ${mockUpstream ? 'mock' : new URL(base).origin})`);
  return {
    server,
    close: () => new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections(); }),
  };
}

const HELP = `Usage: node tools/jev-proxy.mjs [options]
  --port <n>          listen port (default 8787; 0 = ephemeral)
  --root <dir>        static root (default: docs)
  --budget <n>        max upstream calls per process (default 200)
  --rate <n>          requests/second, burst n (default 2)
  --record <path>     write validated request/response pairs to a recording file
  --mock-upstream     canned emulator answers, no network, no key
  --mock-status <c>   with --mock-upstream, fail with the proxy error for upstream status c
  --no-api            static files only; /api/* -> 404 (like GitHub Pages)
  --help              show this help
Key: env TYPESAFE_API_KEY (or X-JEV-Key from the page). Base URL: env TYPESAFE_BASE_URL.`;

function parseArgs(argv) {
  const o = {};
  const num = { '--port': 'port', '--budget': 'budget', '--rate': 'rate', '--mock-status': 'mockStatus' };
  const str = { '--root': 'root', '--record': 'record' };
  const flag = { '--mock-upstream': 'mockUpstream', '--no-api': 'noApi' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help') return { help: true };
    if (flag[a]) o[flag[a]] = true;
    else if (num[a] || str[a]) {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      if (num[a]) {
        if (!/^\d+$/.test(v)) throw new Error(`${a} needs a non-negative integer`);
        o[num[a]] = +v;
      } else o[str[a]] = v;
    } else throw new Error(`unknown option ${a}`);
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`${e.message}\n\n${HELP}`); process.exit(1); }
  if (opts.help) { console.log(HELP); process.exit(0); }
  createProxy(opts).then((p) => {
    const stop = () => p.close().then(() => process.exit(0));
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }, (e) => { console.error(redact(e.message, [process.env.TYPESAFE_API_KEY])); process.exit(1); });
}
