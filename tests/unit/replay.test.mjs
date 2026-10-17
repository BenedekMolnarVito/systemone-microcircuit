import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { circuitRequest, neuronRequest, validateResponse } from '../../docs/js/jev/schema.js';
import { emulate } from '../../docs/js/jev/emulator.js';
import { validateRecording, matchKey, findMatch, buildRecordingEntry, buildRecording, serializeLogEntry } from '../../docs/js/jev/replay.js';

const Z = { vertical: 0, horizontal: 0, diag45: 0, diag135: 0 };
const state = (r = [40, 4, 2, 2], stimulus = 'vbar') => ({
  kind: 'circuit_summary', simTimeMs: 500, windowMs: 500, stimulus, local_label: 'vertical',
  l4_rates_hz: { vertical: r[0], horizontal: r[1], diag45: r[2], diag135: r[3] },
  l23_rates_hz: Z, l5_rates_hz: Z, inhibitory_rates_hz: { pv: 1, sst: 1, vip: 1 }, prev_l4_rates_hz: Z,
});
const entryFor = (req, i = 0) => {
  const v = validateResponse(req, emulate(req, { seed: 42, callIndex: i }));
  assert.ok(v.ok);
  return buildRecordingEntry(i, 500, req, v.response, 281);
};
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

test('U-39 entries/log never contain key material', () => {
  const req = circuitRequest(state());
  const e = entryFor(req);
  const log = serializeLogEntry({ status: 'ok', mode: 'LIVE', request: req, response: e.response, headers: { Authorization: 'Bearer FAKE-1' }, key: 'FAKE-key' });
  for (const s of [JSON.stringify(e), JSON.stringify(log)]) assert.doesNotMatch(s, /Authorization|X-JEV-Key|Bearer|FAKE/);
  assert.equal(e.state, undefined);
  const n = neuronRequest({ kind: 'neuron_summary', neuron: 'L4E-0', population: 'L4E', soma_mv: 7, threshold_mv: 15, apical_mv: 0, rate_hz_last_200ms: 5, collaterals: [] });
  assert.equal(matchKey(n).features.length, 3);
});

test('U-39b validateRecording', () => {
  const e = entryFor(circuitRequest(state()));
  const good = { format: 'jev-recording', version: 1, entries: [e] };
  assert.equal(validateRecording(good).ok, true);
  assert.equal(validateRecording({ ...good, format: 'x' }).ok, false);
  assert.equal(validateRecording({ format: 'jev-recording', version: 1 }).ok, false);
  assert.equal(validateRecording({ ...good, entries: [{ ...e, response: {} }] }).ok, false);
  assert.equal(validateRecording(read('../../docs/data/jev-recording.json')).ok, true);
  assert.equal(validateRecording(read('../fixtures/recording.json')).ok, true);
});

test('U-39c findMatch exact / nearest / null', () => {
  const rec = buildRecording({ model: 'jev-test' }, [entryFor(circuitRequest(state([40, 4, 2, 2])))]);
  assert.equal(findMatch(rec, circuitRequest(state([40, 4, 2, 2])))?.kind, 'exact');
  assert.equal(findMatch(rec, circuitRequest(state([40, 6, 2, 2])))?.kind, 'nearest');
  assert.equal(findMatch(rec, circuitRequest(state([10, 30, 2, 2]))), null);
  assert.equal(findMatch(rec, circuitRequest(state([40, 6, 2, 2], 'hbar'))), null);
});
