import { collateralProbs } from './charts.js';

const ORI = ['vertical', 'horizontal', 'diag45', 'diag135'];
const SCI09 = 'In SIMULATED mode the JEV answers are computed by a simple local formula from L4 firing rates, not by the JEV model. Agreement in this mode shows the plumbing, not JEV\'s judgement. REPLAY and LIVE show genuine JEV answers.';
const MODE_TAG = { SIMULATED: 'SIM', REPLAY: 'REPLAY', LIVE: 'LIVE' };

export function modeTag(status, mode) {
  if (status === 'unrecorded') return 'UNRECORDED';
  if (/^(fallback|error)/.test(status || '')) return 'FALLBACK';
  if (status === 'exact' || status === 'nearest') return 'REPLAY';
  return MODE_TAG[mode] || mode;
}

// FR-JEV-16 local Score level.
export function scoreLevel(S, theta) {
  return S < -2 ? 0 : S < 2 ? 1 : S < theta - 3 ? 2 : S < theta ? 3 : 4;
}

// ctx = {getSim(), getNetwork(), readout(): {label, probs}, agree(label, choice): bool|null}
// Bus in: frame, jev:request, jev:response, jev:error. Bus out: `jev:ask` {ids} (Ask JEV click).
// Derives store.jevReadout and store.compare from jev:response.
export function initDashboard(store, bus, ctx) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const panel = $('readout-panel'), local = $('readout-local'), jevOut = $('readout-jev'), agreeOut = $('readout-agree');
  const ask = $('btn-ask-jev'), warn = $('runaway-warning'), fps = $('fps-meter');
  const inflight = new Map();
  const set = (el, text) => { if (el.textContent !== text) el.textContent = text; };

  panel.title = SCI09;
  const label = document.createElement('span');
  const bars = ORI.map((o) => {
    const row = document.createElement('div'), fill = document.createElement('div');
    row.className = 'readout-bar'; row.setAttribute('data-testid', `readout-bar-${o}`);
    fill.className = 'readout-fill'; row.append(fill);
    return { o, row, fill };
  });
  local.append(label, ...bars.map((b) => b.row));

  const renderCompare = (cmp) => {
    for (const k of ['score', 'noul', 'choice']) {
      const tr = $(`compare-${k}`), v = cmp && cmp[k];
      const cells = [k, v ? v.local : '—', v ? v.jev : '—'].map((x) => {
        const td = document.createElement(x === k ? 'th' : 'td');
        td.textContent = typeof x === 'number' ? x.toFixed(2) : String(x);
        if (x === k) td.scope = 'row';
        return td;
      });
      tr.replaceChildren(...cells);
    }
  };
  renderCompare(null);

  let prev = {};
  store.subscribe((s) => {
    if (s.selection !== prev.selection) set($('selected-neuron-label'), s.selection.length ? s.selection.join(', ') : 'none');
    if (s.compare !== prev.compare) renderCompare(s.compare);
    const jr = s.jevReadout;
    set(jevOut, jr ? `${jr.choice ?? '—'}${jr.confidence == null ? '' : ` · ${Math.round(jr.confidence * 100)}%`} · ${jr.modeTag}` : '—');
    ask.disabled = inflight.size > 0 || (s.mode === 'LIVE' && s.budget.used >= s.budget.cap);
    prev = s;
  });

  ask.addEventListener('click', () => bus.emit('jev:ask', { ids: store.get().selection }));

  const done = (id) => { inflight.delete(id); store.set({}); };
  bus.on('jev:request', (e) => { inflight.set(e.id, e); store.set({}); });
  bus.on('jev:error', (e) => done(e.id));
  bus.on('jev:response', ({ id, result }) => {
    const req = inflight.get(id);
    done(id);
    if (!req) return;
    const mode = result.mode || req.mode, tag = modeTag(result.status, mode);
    const a = result.response && result.response.answers;
    if (req.kind === 'circuit') {
      const o = a && a.circuit_orientation;
      store.set({ jevReadout: { choice: o ? o.choice : null, confidence: o ? o.confidence : null, modeTag: tag } });
    } else if (a) {
      const net = ctx.getNetwork(), sim = ctx.getSim(), st = sim.state, params = store.get().params;
      const i = net.neurons.findIndex((n) => n.id === req.request.state.neuron);
      if (i < 0) return;
      let lc = '—';
      if (net.neurons[i].excitatory) {
        const p = collateralProbs(net, i, st, params, sim.control.betaOutput);
        lc = net.collaterals[i][p.indexOf(Math.max(...p))].id;
      }
      store.set({ compare: {
        score: { local: scoreLevel(st.S[i], params.theta), jev: a.neuron_score ? a.neuron_score.score : '—' },
        noul: { local: st.noul[i], jev: a.neuron_noul ? a.neuron_noul.noul : '—' },
        choice: { local: lc, jev: a.neuron_choice ? a.neuron_choice.choice : '—' },
      } });
    }
  });

  const dts = [];
  let lastWall = 0;
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  bus.on('frame', (f) => {
    const sim = ctx.getSim(), r = ctx.readout();
    set(label, r.label);
    bars.forEach((b, k) => {
      const w = `${Math.round((r.probs[k] || 0) * 100)}%`;
      if (b.fill.style.width !== w) { b.fill.style.width = w; b.row.dataset.prob = w; }
    });
    const jr = store.get().jevReadout, ag = ctx.agree(r.label, jr ? jr.choice : null);
    set(agreeOut, ag == null ? '' : ag ? 'agree' : 'disagree');
    const st = sim.stats;
    warn.hidden = !st.runawayActive;
    if (st.runawayActive) set(warn, `Runaway activity — excitation auto-damped to ${Math.round(st.dampGain * 100)}%`);
    if (debug) {
      const now = performance.now();
      if (lastWall) { dts.push(now - lastWall); if (dts.length > 120) dts.shift(); }
      lastWall = now;
      const s = dts.map((d) => 1000 / d).sort((x, y) => x - y);
      fps.hidden = false;
      set(fps, `fps ${s.length ? s[s.length >> 1].toFixed(0) : '—'}${f.capped ? ' · sim slowed' : ''}`);
    }
  });
}
