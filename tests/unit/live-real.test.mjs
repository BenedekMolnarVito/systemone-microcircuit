// FR-TST-05/08: only test allowed to read process.env. Max 1 billed call, skipped unless JEV_LIVE_TEST=1 + key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createProxy } from '../../tools/jev-proxy.mjs';
import { circuitRequest, validateResponse } from '../../docs/js/jev/schema.js';

const optIn = process.env.JEV_LIVE_TEST === '1';
const key = optIn && process.env.TYPESAFE_API_KEY; // key read only behind the opt-in gate (FR-TST-08)
const live = optIn && !!key;

test('live JEV via proxy (1 billed call)', { skip: !live && 'set JEV_LIVE_TEST=1 and TYPESAFE_API_KEY' }, async () => {
  const p = await createProxy({ port: 0, env: { TYPESAFE_API_KEY: key }, log() {} });
  const port = p.server.address().port;
  const req = circuitRequest({
    kind: 'circuit_summary', description: 'live smoke', simTimeMs: 500, windowMs: 500, stimulus: 'vbar',
    l4_rates_hz: { vertical: 34.5, horizontal: 2.1, diag45: 6, diag135: 5.2 },
    l23_rates_hz: { vertical: 28, horizontal: 1.2, diag45: 3.9, diag135: 3.1 },
    l5_rates_hz: { vertical: 19.5, horizontal: 0, diag45: 2.5, diag135: 0 },
    inhibitory_rates_hz: { pv: 22.1, sst: 9.8, vip: 7.5 },
    prev_l4_rates_hz: { vertical: 1, horizontal: 0.8, diag45: 1.1, diag135: 0.9 }, local_readout: 'vertical',
  });
  try {
    const body = JSON.stringify(req);
    const r = await new Promise((resolve, reject) => {
      const q = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/api/jev', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let t = '';
        res.on('data', (d) => (t += d));
        res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(t) }));
      });
      q.on('error', reject);
      q.end(body);
    });
    assert.equal(r.status, 200);
    assert.equal(validateResponse(req, r.json).ok, true);
  } finally {
    await p.close();
  }
});
