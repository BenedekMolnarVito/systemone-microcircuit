import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createProxy } from '../../tools/jev-proxy.mjs';
import { circuitRequest } from '../../docs/js/jev/schema.js';
import { emulate } from '../../docs/js/jev/emulator.js';
import { validateRecording } from '../../docs/js/jev/replay.js';

const KEY = 'test-key-FAKE-123';
const HKEY = 'hdr-key-FAKE-456';
const STATE = {
  kind: 'circuit_summary', description: 'd', simTimeMs: 1500, windowMs: 500, stimulus: 'vbar',
  l4_rates_hz: { vertical: 34.5, horizontal: 2.1, diag45: 6, diag135: 5.2 },
  l23_rates_hz: { vertical: 28, horizontal: 1.2, diag45: 3.9, diag135: 3.1 },
  l5_rates_hz: { vertical: 19.5, horizontal: 0, diag45: 2.5, diag135: 0 },
  inhibitory_rates_hz: { pv: 22.1, sst: 9.8, vip: 7.5 },
  prev_l4_rates_hz: { vertical: 1, horizontal: 0.8, diag45: 1.1, diag135: 0.9 }, local_readout: 'vertical',
};
const REQ = circuitRequest(STATE);
const GOOD = { ...emulate(REQ, { seed: 1, callIndex: 0 }), usage: { input_tokens: 10, output_tokens: 2 } };

function raw(port, { method = 'GET', url = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url, agent: false, headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => {
        const text = Buffer.concat(c).toString();
        let json = null;
        try { json = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, text, json });
      });
    });
    r.on('error', reject);
    r.end(body);
  });
}
const post = (port, body, headers = {}) => raw(port, { method: 'POST', url: '/api/jev', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

async function fake(handler) {
  const seen = [];
  const s = http.createServer((req, res) => {
    const c = [];
    req.on('data', (d) => c.push(d));
    req.on('end', () => { seen.push({ headers: req.headers, body: Buffer.concat(c).toString() }); handler(req, res, seen.length); });
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { seen, port: s.address().port, close: () => { s.closeAllConnections(); return new Promise((r) => s.close(r)); } };
}
const ok = (_q, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(GOOD)); };

async function withProxy(opts, fn, upstreamHandler = ok) {
  const up = await fake(upstreamHandler);
  const lines = [];
  const p = await createProxy({ port: 0, rate: 1000, log: (l) => lines.push(l), ...opts, env: { TYPESAFE_API_KEY: KEY, TYPESAFE_BASE_URL: `http://127.0.0.1:${up.port}`, ...opts.env } });
  try { await fn(p.server.address().port, up, lines); } finally { await p.close(); await up.close(); }
}

test('P-01/P-02 binds loopback, health keySource', async () => {
  await withProxy({}, async (port) => {
    const h = await raw(port, { url: '/api/health' });
    assert.equal(h.status, 200);
    assert.deepEqual([h.json.ok, h.json.keySource, h.json.model, h.json.budget.cap], [true, 'env', 'jev-latest', 200]);
  });
  const p = await createProxy({ port: 0, env: {}, log() {} });
  assert.equal(p.server.address().address, '127.0.0.1');
  assert.equal((await raw(p.server.address().port, { url: '/api/health' })).json.keySource, 'none');
  await p.close();
  const m = await createProxy({ port: 0, mockUpstream: true, env: { TYPESAFE_API_KEY: KEY }, log() {} });
  assert.equal((await raw(m.server.address().port, { url: '/api/health' })).json.keySource, 'mock');
  await m.close();
});

test('P-03/P-04 upstream headers and no key in logs', async () => {
  await withProxy({}, async (port, up, lines) => {
    const r = await post(port, REQ, { 'X-JEV-Key': HKEY, Cookie: 'a=b' });
    assert.equal(r.status, 200);
    const h = up.seen[0].headers;
    assert.equal(h.authorization, `Bearer ${KEY}`);
    assert.deepEqual([h['x-jev-key'], h.origin, h.cookie], [undefined, undefined, undefined]);
    await post(port, '{bad', { 'X-JEV-Key': HKEY });
    assert.equal(lines.filter((l) => l.includes(' POST /api/jev ')).length, 2);
    assert.ok(!lines.join('\n').includes(KEY) && !lines.join('\n').includes(HKEY));
  });
  await withProxy({ env: { TYPESAFE_API_KEY: '' } }, async (port, up, lines) => {
    const r = await post(port, REQ, { 'X-JEV-Key': HKEY });
    assert.equal(r.status, 200);
    assert.equal(up.seen[0].headers.authorization, `Bearer ${HKEY}`);
    assert.ok(!lines.join('\n').includes(HKEY));
  });
});

test('P-05/P-06/P-07 origin, content-type, host', async () => {
  await withProxy({}, async (port, up) => {
    for (const h of [{ Origin: 'https://evil.example' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
      const r = await post(port, REQ, h);
      assert.equal(r.status, 403);
      assert.equal(r.json.error.code, 'bad_origin');
    }
    assert.equal((await post(port, REQ, { Origin: `http://localhost:${port}` })).status, 200);
    assert.equal((await post(port, REQ, { Host: `LOCALHOST:${port}` })).status, 200);
    const t = await post(port, REQ, { 'Content-Type': 'text/plain' });
    assert.equal(t.status, 415);
    assert.equal(up.seen.length, 2);
    const b = await post(port, REQ, { Host: `evil.example:${port}` });
    assert.equal(b.status, 421);
    assert.equal(b.json.error.code, 'bad_host');
  });
});

test('P-08/P-10/P-13 upstream status mapping', async () => {
  const cases = [[401, 401, 'unauthorized'], [403, 403, 'forbidden'], [422, 422, 'upstream_rejected'], [529, 503, 'upstream_overloaded'], [500, 502, 'upstream_malformed']];
  for (const [us, st, code] of cases) {
    await withProxy({}, async (port) => {
      const r = await post(port, REQ);
      assert.deepEqual([r.status, r.json.error.code], [st, code]);
    }, (_q, res) => { res.writeHead(us, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ detail: { message: `has ${KEY} inside` } })); });
  }
  for (const [ra, want] of [['3', '3'], ['999', undefined], ['soon', undefined]]) {
    await withProxy({}, async (port) => {
      const r = await post(port, REQ);
      assert.deepEqual([r.status, r.json.error.code, r.headers['retry-after']], [429, 'upstream_rate_limited', want]);
      assert.ok(!r.text.includes(KEY));
    }, (_q, res) => { res.writeHead(429, { 'Retry-After': ra }); res.end('{}'); });
  }
  await withProxy({}, async (port) => {
    const r = await post(port, REQ);
    assert.deepEqual([r.status, r.json.error.code], [502, 'upstream_malformed']);
  }, (_q, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>'); });
});

test('P-09 path traversal and directories', async () => {
  await withProxy({}, async (port) => {
    for (const u of ['/../tools/jev-proxy.mjs', '/%2e%2e/package.json', '/%00', '/..%5c..%5ctools/jev-proxy.mjs', '/C:/Windows/win.ini', '/../docs-x/', '/css/', '/%zz']) {
      assert.equal((await raw(port, { url: u })).status, 404, u);
    }
  });
});

test('P-11 body limits and validation', async () => {
  await withProxy({}, async (port, up) => {
    const big = JSON.stringify({ ...REQ, pad: 'x'.repeat(32769) });
    assert.equal((await post(port, big).catch(() => ({ status: 413 }))).status, 413);
    const bad = await post(port, '{nope');
    assert.deepEqual([bad.status, bad.json.error.code], [400, 'bad_request']);
    const nine = { ...REQ, questions: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`q${i}`, { type: 'noul', instructions: 'x' }])) };
    assert.equal((await post(port, nine)).status, 400);
    const dict = { ...REQ, questions: { q: { type: 'score', instructions: 'x', criteria: { a: 'b', c: 'd' } } } };
    assert.equal((await post(port, dict)).status, 400);
    assert.equal((await post(port, { ...REQ, model: 'gpt-4' })).status, 400);
    assert.equal((await post(port, { ...REQ, extra: 1 })).status, 400);
    assert.equal(up.seen.length, 0);
  });
});

test('P-12 upstream timeout', async () => {
  await withProxy({}, async (port) => {
    const t0 = Date.now();
    const r = await post(port, REQ);
    assert.deepEqual([r.status, r.json.error.code], [504, 'timeout']);
    assert.ok(Date.now() - t0 < 5500);
  }, () => { /* never answers */ });
});

test('P-14 budget counts failed attempts', async () => {
  await withProxy({ budget: 2 }, async (port) => {
    assert.equal((await post(port, REQ)).status, 503);
    assert.equal((await post(port, REQ)).status, 503);
    const r = await post(port, REQ);
    assert.deepEqual([r.status, r.json.error.code], [429, 'budget_exhausted']);
  }, (_q, res) => { res.writeHead(503); res.end('{}'); });
});

test('rate limit token bucket', async () => {
  await withProxy({ rate: 1 }, async (port) => {
    assert.equal((await post(port, REQ)).status, 200);
    const r = await post(port, REQ);
    assert.deepEqual([r.status, r.json.error.code, r.headers['retry-after']], [429, 'rate_limited', '1']);
  });
});

test('P-15 OPTIONS 405 without CORS', async () => {
  await withProxy({}, async (port) => {
    const r = await raw(port, { method: 'OPTIONS', url: '/api/jev', headers: { Origin: `http://127.0.0.1:${port}` } });
    assert.equal(r.status, 405);
    assert.ok(!Object.keys(r.headers).some((h) => h.startsWith('access-control-')));
  });
});

test('P-16 record file is clean and valid', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jevrec-')), 'rec.json');
  await withProxy({ record: f }, async (port) => {
    assert.equal((await post(port, REQ)).status, 200);
    assert.equal((await post(port, REQ)).status, 200);
  }, (_q, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ...GOOD, x_debug: 'FAKE-debug' })); });
  const txt = fs.readFileSync(f, 'utf8');
  const j = JSON.parse(txt);
  assert.ok(validateRecording(j).ok !== false);
  assert.equal(j.entries.length, 2);
  assert.ok(!txt.includes(KEY) && !txt.includes('x_debug'));
  assert.equal(j.app.commit, null);
  assert.equal(j.entries[0].simTimeMs, 1500);
});

test('P-17 no key', async () => {
  await withProxy({ env: { TYPESAFE_API_KEY: '' } }, async (port, up) => {
    const r = await post(port, REQ);
    assert.deepEqual([r.status, r.json.error.code], [401, 'no_key']);
    assert.equal(up.seen.length, 0);
  });
});

test('P-18 static headers and mime', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jevroot-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<p>hi</p>');
  fs.writeFileSync(path.join(root, 'a.js'), '1');
  fs.writeFileSync(path.join(root, 'a.css'), 'b{}');
  fs.writeFileSync(path.join(root, 'a.xyz'), 'z');
  await withProxy({ root }, async (port) => {
    const want = { '/a.js': 'text/javascript', '/a.css': 'text/css', '/a.xyz': 'application/octet-stream', '/': 'text/html' };
    for (const [u, ct] of Object.entries(want)) {
      const r = await raw(port, { url: u });
      assert.equal(r.status, 200);
      assert.ok(r.headers['content-type'].startsWith(ct), u);
      assert.equal(r.headers['x-content-type-options'], 'nosniff');
      assert.equal(r.headers['x-frame-options'], 'DENY');
      assert.equal(r.headers['referrer-policy'], 'no-referrer');
      assert.ok(r.headers['content-security-policy'].includes("frame-ancestors 'none'"));
    }
    assert.equal((await raw(port, { method: 'POST', url: '/index.html' })).status, 405);
  });
});

test('P-19 mock upstream makes no outbound call', async () => {
  const up = await fake(ok);
  const p = await createProxy({ port: 0, rate: 1000, mockUpstream: true, env: { TYPESAFE_API_KEY: KEY, TYPESAFE_BASE_URL: `http://127.0.0.1:${up.port}` }, log() {} });
  const port = p.server.address().port;
  for (let i = 0; i < 5; i++) {
    const r = await post(port, REQ);
    assert.equal(r.status, 200);
    assert.equal(r.json.model, 'jev-mock');
  }
  assert.equal(up.seen.length, 0);
  assert.equal((await raw(port, { url: '/api/health' })).json.budget.used, 5);
  await p.close();
  const s = await createProxy({ port: 0, mockUpstream: true, mockStatus: 429, env: {}, log() {} });
  assert.equal((await post(s.server.address().port, REQ)).json.error.code, 'upstream_rate_limited');
  await s.close();
  await up.close();
});

test('P-20 noApi', async () => {
  const p = await createProxy({ port: 0, noApi: true, env: {}, log() {} });
  const port = p.server.address().port;
  assert.equal((await raw(port, { url: '/api/health' })).status, 404);
  assert.equal((await post(port, REQ)).status, 404);
  assert.equal((await raw(port, { url: '/' })).status, 200);
  await p.close();
});

test('P-21 bad base URL rejected', async () => {
  await assert.rejects(createProxy({ port: 0, env: { TYPESAFE_BASE_URL: 'http://evil.example' }, log() {} }));
  const c = spawn(process.execPath, ['tools/jev-proxy.mjs', '--port', '0'], { env: { ...process.env, TYPESAFE_API_KEY: '', TYPESAFE_BASE_URL: 'http://evil.example' } });
  const code = await new Promise((r) => c.on('exit', r));
  assert.equal(code, 1);
});

test('P-22 CLI start line and shutdown', async () => {
  const c = spawn(process.execPath, ['tools/jev-proxy.mjs', '--port', '0', '--mock-upstream'], { env: { ...process.env, TYPESAFE_API_KEY: '', TYPESAFE_BASE_URL: '' } });
  let out = '';
  await new Promise((r) => { c.stdout.on('data', (d) => { out += d; if (out.includes('\n')) r(); }); });
  assert.match(out, /^systemone-microcircuit proxy listening on http:\/\/127\.0\.0\.1:\d+ \(key: mock, api: on, upstream: mock\)\n$/);
  const exited = new Promise((r) => c.on('exit', r));
  const t0 = Date.now();
  c.kill();
  await exited;
  assert.ok(Date.now() - t0 < 2000);
});
