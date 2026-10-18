import { RingBuffer } from '../core/ringbuffer.js';
import { DT } from '../core/params.js';

const WIN = 1000, BIN = 10, NBIN = 500, SMOOTH = 5; // ms, ms, bins, bins (50 ms boxcar)
const SERIES = ['S', 'Db', 'Da', 'noul'];
const DASH = [[], [6, 3], [1.5, 3], []];
const SLOT = ['--accent', '--warn', '--vip'];
const LAYER_DASH = { L4: [], L2: [5, 3], L5: [1.5, 3] };
const clsVar = (pop) => (pop.endsWith('PV') ? '--pv' : pop.endsWith('SST') ? '--sst' : pop.endsWith('VIP') ? '--vip' : '--exc');

// SPEC 2.5 current p_k: softmax over collateral logits incl. JEV bias beta on L23E `output` (FR-JEV-16), same as sim.js.
export function collateralProbs(network, i, state, params, betaOutput = 0) {
  const cols = network.collaterals[i] || [];
  const l23 = network.neurons[i].pop === 'L23E', tc = Math.max(0.05, params.tauC);
  const a = cols.map((c) => c.b + c.gamma * (state.Da[i] / params.theta) + (l23 && c.id === 'output' ? betaOutput : 0));
  const m = Math.max(...a);
  const e = a.map((x) => Math.exp((x - m) / tc));
  const s = e.reduce((x, y) => x + y, 0);
  return e.map((x) => x / s);
}

// ctx = {getSim(), getNetwork()}; listens to bus `frame` and `reset`.
export function initCharts(store, bus, ctx) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const g = {};
  for (const k of ['raster', 'trace', 'noul', 'rate']) g[k] = $(`${k}-canvas`).getContext('2d');
  const bars = $('choice-bars');
  let net = null, popOf, spikeT, spikeI, rates, counts, binIdx, lastN, trT, trV, trKey, routeLog, barsFor, barEls, css;

  function reset() {
    popOf = net.neurons.map((n) => net.pops.findIndex((p) => p.id === n.pop));
    spikeT = new RingBuffer(29000, Float64Array);
    spikeI = new RingBuffer(29000, Uint8Array);
    rates = net.pops.map(() => new RingBuffer(NBIN));
    counts = new Float32Array(net.pops.length);
    binIdx = 0; lastN = 0; routeLog = []; trKey = null; barsFor = undefined;
    trT = new RingBuffer(2000, Float64Array);
    trV = Array.from({ length: 12 }, () => new RingBuffer(2000));
  }
  const advance = (b) => {
    for (; binIdx < b; binIdx++) for (let p = 0; p < counts.length; p++) { rates[p].push(counts[p]); counts[p] = 0; }
  };
  const col = (v) => css.getPropertyValue(v).trim();
  const clear = (c) => c.clearRect(0, 0, c.canvas.width, c.canvas.height);

  function line(c, xs, ys, now, lo, hi, color, dash) {
    const W = c.canvas.width, H = c.canvas.height;
    c.strokeStyle = color; c.setLineDash(dash); c.beginPath();
    for (let k = 0; k < xs.length; k++) {
      const x = ((xs[k] - (now - WIN)) / WIN) * W;
      const y = H - ((Math.min(Math.max(ys[k], lo), hi) - lo) / (hi - lo)) * H;
      if (k) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.stroke(); c.setLineDash([]);
  }

  function drawRaster(now) {
    const c = g.raster, W = c.canvas.width, rowH = c.canvas.height / net.N, t0 = now - WIN;
    clear(c);
    const colors = net.pops.map((p) => col(clsVar(p.id)));
    c.globalAlpha = 0.12;
    net.pops.forEach((p, k) => { c.fillStyle = colors[k]; c.fillRect(0, p.start * rowH, W, p.count * rowH); });
    c.globalAlpha = 1;
    for (let k = 0; k < spikeT.length; k++) {
      const t = spikeT.get(k);
      if (t < t0) continue;
      const i = spikeI.get(k);
      c.fillStyle = colors[popOf[i]];
      c.fillRect(((t - t0) / WIN) * W, i * rowH, 1.5, Math.max(1, rowH - 1));
    }
  }

  function drawTraces(now, sel) {
    const ct = g.trace, cn = g.noul, theta = store.get().params.theta, xs = trT.toArray();
    clear(ct); clear(cn);
    const H = ct.canvas.height, lo = -20, hi = 40, ty = H - ((theta - lo) / (hi - lo)) * H;
    ct.strokeStyle = col('--text-muted'); ct.setLineDash([2, 4]); ct.beginPath();
    ct.moveTo(0, ty); ct.lineTo(ct.canvas.width, ty); ct.stroke(); ct.setLineDash([]);
    cn.fillStyle = col('--text-muted'); cn.font = '10px sans-serif';
    cn.fillText('Noul = P(≥ 1 spike in 10 ms)', 4, 11);
    sel.forEach((_, s) => {
      const color = col(SLOT[s]);
      for (let q = 0; q < 3; q++) line(ct, xs, trV[s * 4 + q].toArray(), now, lo, hi, color, DASH[q]);
      line(cn, xs, trV[s * 4 + 3].toArray(), now, 0, 1, color, []);
    });
  }

  function drawRates() {
    const c = g.rate, W = c.canvas.width, H = c.canvas.height;
    clear(c);
    const series = rates.map((r, p) => {
      const a = r.toArray(), hz = net.pops[p].count * (BIN / 1000), out = new Float32Array(a.length);
      for (let k = 0; k < a.length; k++) {
        let s = 0, m = 0;
        for (let j = Math.max(0, k - SMOOTH + 1); j <= k; j++) { s += a[j]; m++; }
        out[k] = s / m / hz;
      }
      return out;
    });
    const hi = Math.max(10, ...series.map((s) => Math.max(0, ...s)));
    series.forEach((s, p) => {
      const id = net.pops[p].id;
      c.strokeStyle = col(clsVar(id)); c.setLineDash(LAYER_DASH[id.slice(0, 2)]); c.beginPath();
      s.forEach((v, k) => {
        const x = W - ((s.length - 1 - k) / NBIN) * W, y = H - (v / hi) * H;
        if (k) c.lineTo(x, y); else c.moveTo(x, y);
      });
      c.stroke();
    });
    c.setLineDash([]); c.fillStyle = col('--text-muted'); c.font = '10px sans-serif';
    c.fillText(`${hi.toFixed(0)} Hz max`, 4, 11);
  }

  function drawBars() {
    const id = store.get().selection[0];
    const i = net.neurons.findIndex((n) => n.id === id);
    if (id !== barsFor) {
      barsFor = id; barEls = [];
      bars.replaceChildren();
      if (i >= 0 && !net.neurons[i].excitatory) bars.textContent = 'Interneuron: local axon, no Choice';
      else if (i >= 0) {
        for (const cl of net.collaterals[i]) {
          const row = document.createElement('div');
          row.className = 'choice-bar';
          row.setAttribute('data-testid', `choice-bar-${cl.id}`);
          const label = document.createElement('span');
          const track = document.createElement('div'), fill = document.createElement('div');
          track.className = 'choice-track'; fill.className = 'choice-fill';
          track.append(fill); row.append(label, track);
          bars.append(row); barEls.push({ row, label, fill, cl });
        }
      }
    }
    if (i < 0 || !net.neurons[i].excitatory) return;
    const params = store.get().params;
    const sim = ctx.getSim(), p = collateralProbs(net, i, sim.state, params, sim.control.betaOutput);
    const soft = params.routing === 'soft';
    const chosen = barEls.map((_, k) => routeLog.reduce((s, r) => (r.src !== i ? s : s + (soft ? r.p[k] : r.k === k ? 1 : 0)), 0));
    const tot = chosen.reduce((a, b) => a + b, 0);
    barEls.forEach((e, k) => {
      const pk = Math.round(p[k] * 100), ck = tot ? Math.round((chosen[k] / tot) * 100) : 0;
      const txt = `${e.cl.id} p=${pk}% chosen ${ck}%`;
      if (e.label.textContent === txt) return;
      e.label.textContent = txt;
      e.fill.style.width = `${pk}%`;
      e.row.style.setProperty('--chosen', `${ck}%`);
      e.row.dataset.p = String(pk); e.row.dataset.chosen = String(ck);
    });
  }

  bus.on('reset', () => { if (net) reset(); });
  bus.on('frame', ({ routes }) => {
    const sim = ctx.getSim(), n = ctx.getNetwork();
    if (n !== net) { net = n; reset(); }
    if (sim.n < lastN) reset();
    const sp = sim.spikesSince(lastN);
    lastN = sim.n;
    for (let j = 0; j < sp.length; j += 2) {
      const t = sp[j] * DT, i = sp[j + 1];
      spikeT.push(t); spikeI.push(i);
      advance(Math.floor(t / BIN));
      counts[popOf[i]]++;
    }
    advance(Math.floor(sim.t / BIN));
    const now = sim.t;
    for (const r of routes || []) routeLog.push({ src: r.src, k: r.k, p: r.p, t: now });
    while (routeLog.length && routeLog[0].t < now - WIN) routeLog.shift();

    const sel = store.get().selection.slice(0, 3).map((id) => net.neurons.findIndex((x) => x.id === id)).filter((i) => i >= 0);
    const key = sel.join();
    if (key !== trKey) { trKey = key; trT.clear(); trV.forEach((b) => b.clear()); }
    trT.push(now);
    const st = sim.state;
    sel.forEach((i, s) => SERIES.forEach((k, q) => trV[s * 4 + q].push(st[k][i])));

    css = getComputedStyle(document.documentElement);
    drawRaster(now); drawTraces(now, sel); drawRates(); drawBars();
  });
}
