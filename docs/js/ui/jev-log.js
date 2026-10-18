import { buildRecordingEntry, buildRecording } from '../jev/replay.js';

const MAX = 200;

const summarize = (answers) => Object.entries(answers || {}).map(([k, a]) => {
  const v = a.type === 'choice' ? a.choice : a.type === 'noul' ? a.noul : a.score;
  return `${k}=${v}`;
}).join(', ');

// ctx = {getSim()}. Bus in: jev:request, jev:response, jev:error, reset.
export function initJevLog(store, bus, ctx) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const list = $('jev-log'), exportBtn = $('btn-export-recording');
  const pending = new Map(), okCalls = [];
  let n = 0;

  const syncExport = () => { exportBtn.disabled = !(store.get().mode === 'LIVE' && okCalls.length > 0); };
  const pre = (obj) => {
    const p = document.createElement('pre');
    p.textContent = JSON.stringify(obj, null, 2);
    return p;
  };
  const add = (li) => {
    list.prepend(li);
    while (list.children.length > MAX) list.lastElementChild.remove();
  };

  function entry(id, status, mode, latency, summary, response) {
    const req = pending.get(id) || {};
    pending.delete(id);
    const li = document.createElement('li');
    li.setAttribute('data-testid', 'jev-log-entry');
    const head = document.createElement('span');
    head.textContent = `#${++n} · t=${(req.t ?? 0).toFixed(1)} · ${mode || req.mode} · ${req.kind || '?'} · ${status} · ${latency == null ? '—' : Math.round(latency)} ms · ${summary}`;
    const det = document.createElement('details'), sum = document.createElement('summary');
    sum.textContent = 'request / response';
    const r = req.request;
    det.append(sum, pre(r ? { state: r.state, questions: r.questions } : null), pre(response ?? null));
    li.append(head, det);
    add(li);
    return req;
  }

  bus.on('jev:request', (e) => pending.set(e.id, { ...e, t: ctx.getSim().t }));
  bus.on('jev:response', ({ id, result }) => {
    const status = result.status || (result.ok ? 'ok' : 'error');
    const r = result.response;
    const req = entry(id, status, result.mode, result.latencyMs, r ? summarize(r.answers) : (result.error && result.error.message) || '', r);
    if (status === 'ok' && (result.mode || req.mode) === 'LIVE' && r) {
      okCalls.push({ request: req.request, result, t: req.t });
      if (okCalls.length > 500) okCalls.shift();
      syncExport();
    }
  });
  bus.on('jev:error', ({ id, code, message }) => entry(id, code === 'aborted' ? 'aborted' : `error:${code}`, null, null, message || '', null));
  bus.on('reset', () => {
    const li = document.createElement('li');
    li.className = 'jev-log-reset'; li.textContent = '— reset —';
    add(li);
  });
  $('btn-clear-log').addEventListener('click', () => list.replaceChildren());
  store.subscribe(syncExport);
  syncExport();

  exportBtn.addEventListener('click', () => {
    const s = store.get();
    const entries = okCalls.map((c, i) => buildRecordingEntry(i, c.t, c.request, c.result.response, c.result.latencyMs));
    const rec = buildRecording({ model: okCalls[0].result.response.model, seed: s.seed, params: s.params, stimulusSequence: null, app: null }, entries);
    const url = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'jev-recording.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}
