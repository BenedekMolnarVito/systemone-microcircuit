// Circuit view (T11): SVG neurons, collateral paths, spike glow, particles, selection, tooltip.
// initCircuitView({store, bus, getNetwork, getSim}) -> {render(frame), setNetwork(net), destroy()}
// frame = {stepsRun, spikes: Int32Array neuron ids, routes: [{src,k,p}], pixelSpikes?: Uint8Array(256)}
import { DT } from '../core/params.js';

const NS = 'http://www.w3.org/2000/svg';
const ROW_Y = { L4: 230, L23: 380, L5: 520 };
const ORI = ['vertical', 'horizontal', 'diag45', 'diag135'];
const GLYPH = ['|', '—', '/', '\\'];
const LAYER_OF = (pop) => (pop.startsWith('L23') ? 'L23' : pop.startsWith('L5') ? 'L5' : 'L4');
const CLS = (pop) => (pop.endsWith('E') ? 'exc' : pop.endsWith('PV') ? 'pv' : pop.endsWith('SST') ? 'sst' : 'vip');
const CLS_NAME = { exc: 'excitatory', pv: 'PV', sst: 'SST', vip: 'VIP' };
const LAYER_NAME = { L4: 'L4', L23: 'L2/3', L5: 'L5' };
const MAX_PARTICLES = 300;

const el = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

export function initCircuitView({ store, bus, getNetwork, getSim }) {
  const svg = document.querySelector('[data-testid="circuit-svg"]');
  const tip = document.querySelector('[data-testid="tooltip"]');
  const gridG = svg.querySelector('[data-testid="input-grid"]');
  const legendG = svg.querySelector('[data-testid="legend"]');
  for (const [id, txt] of [['input', 'Input 16×16'], ['L4', 'L4'], ['L23', 'L2/3'], ['L5', 'L5']]) {
    svg.querySelector(`[data-testid="layer-label-${id}"]`).textContent = txt;
  }

  // input grid: 16x16 cells of 8 px centred at (400, 70)
  const cells = [];
  for (let i = 0; i < 256; i++) {
    cells.push(el('rect', { x: 336 + (i % 16) * 8, y: 6 + Math.floor(i / 16) * 8, width: 8, height: 8, class: 'px' }, gridG));
  }

  // legend
  [['E', 'exc'], ['PV', 'pv'], ['SST', 'sst'], ['VIP', 'vip']].forEach(([t, c], i) => {
    const x = 8 + i * 60;
    el('circle', { cx: x + 6, cy: 580, r: 6, style: `fill:var(--${c})` }, legendG);
    el('text', { x: x + 16, y: 584 }, legendG).textContent = t;
  });
  el('text', { x: 260, y: 584 }, legendG).textContent = 'fill = S/θ (Score)';
  el('circle', { cx: 440, cy: 580, r: 6, class: 'lg-spk' }, legendG);
  el('text', { x: 452, y: 584 }, legendG).textContent = 'spike';

  let net = null;
  let nodes = [];            // per neuron index: {g, shape, x, y, fill, until, rate, label, cls, n}
  let paths = new Map();     // `${neuronIdx}:${k}` -> {path, len, dSteps, flashUntil}
  let gLayer = null;
  const particles = [];
  let raf = 0, lastLabel = 0, lastSvgLabel = 0, spikesSec = [], hovered = -1;
  const lastChosen = new Map(); // neuron idx -> collateral id
  const reduced = () => !!store.get().reducedMotion;

  function place(n) {
    const lay = LAYER_OF(n.pop), y = ROW_Y[lay];
    if (n.excitatory) return [70 + n.o * 145 + n.j * 30, y];
    const same = net.neurons.filter((m) => !m.excitatory && LAYER_OF(m.pop) === lay);
    const r = same.indexOf(n);
    return [640 + (r % 5) * 28, y + (r < 5 ? -22 : 22)];
  }

  function setNetwork(network) {
    net = network;
    if (gLayer) gLayer.remove();
    gLayer = el('g', { class: 'nodes' }, svg);
    const colG = el('g', { class: 'collaterals' }, gLayer), nodeG = el('g', {}, gLayer);
    nodes = []; paths = new Map(); particles.length = 0; lastChosen.clear();
    net.neurons.forEach((n) => {
      const [x, y] = place(n);
      const cls = CLS(n.pop);
      const g = el('g', { 'data-testid': `neuron-${n.id}`, tabindex: 0, role: 'button', class: `neuron ${cls}`, transform: `translate(${x},${y})` }, nodeG);
      const shape = n.excitatory ? el('path', { d: 'M0,-10 L9,8 L-9,8 Z' }, g) : el('circle', { r: 6 }, g);
      nodes.push({ g, shape, x, y, fill: '', until: 0, rate: 0, label: '', cls, n });
      g.addEventListener('click', (e) => select(n.id, e.shiftKey));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id, e.shiftKey); } });
      g.addEventListener('mouseenter', () => showTip(n.index));
      g.addEventListener('focus', () => showTip(n.index));
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('blur', hideTip);
    });
    // orientation glyph labels above E groups
    net.pops.filter((p) => p.excitatory).forEach((p) => {
      const gs = p.count / 4;
      for (let o = 0; o < 4; o++) {
        const nx = 70 + o * 145 + ((gs - 1) * 30) / 2;
        el('text', { x: nx, y: ROW_Y[LAYER_OF(p.id)] - 30, class: 'ori', 'text-anchor': 'middle' }, gLayer).textContent = GLYPH[o];
      }
    });
    // collateral bundles: one path per E-neuron collateral
    net.collaterals.forEach((cols, i) => cols.forEach((c) => {
      const s = nodes[i];
      let d;
      if (c.targets.length) {
        const tx = c.targets.reduce((a, t) => a + nodes[t.target].x, 0) / c.targets.length;
        const ty = c.targets.reduce((a, t) => a + nodes[t.target].y, 0) / c.targets.length;
        const bend = c.id === 'recurrent' ? 40 : c.id === 'lateral' ? -20 : 0;
        d = `M${s.x},${s.y} Q${(s.x + tx) / 2 + bend},${(s.y + ty) / 2} ${tx},${ty}`;
      } else d = `M${s.x},${s.y} L${s.x},${s.y + 32}`; // L5E output: leaves the circuit
      const path = el('path', { 'data-testid': `collateral-${s.n.id}-${c.id}`, d, class: `col col-${c.id}` }, colG);
      paths.set(`${i}:${c.k}`, { path, len: path.getTotalLength?.() || 0, dSteps: c.targets[0]?.dSteps ?? 3, flashUntil: 0 });
    }));
    applySelection();
  }

  function select(id, add) {
    let ids = store.get().selection || [];
    ids = add ? (ids.includes(id) ? ids : [...ids, id].slice(-3)) : [id];
    store.set({ selection: ids });
    bus.emit('neuron:selected', { ids });
  }
  function applySelection() {
    const sel = store.get().selection || [];
    nodes.forEach((nd) => nd.g.classList.toggle('sel', sel.includes(nd.n.id)));
  }
  store.subscribe(applySelection);
  if (!(store.get().selection || []).length) store.set({ selection: ['L23E-1'] });

  function tipText(i) {
    const nd = nodes[i], n = nd.n, st = getSim()?.state, f = (v) => (v == null ? '–' : v.toFixed(1));
    const lines = [`${n.id} (${n.pop})`, `S ${f(st?.S[i])} mV`];
    if (n.excitatory) {
      lines.push(`Db ${f(st?.Db[i])} mV`);
      if (n.pop !== 'L4E') lines.push(`Da ${f(st?.Da[i])} mV`);
    }
    lines.push(`Noul ${st ? st.noul[i].toFixed(2) : '–'}`, `rate ${nd.rate.toFixed(1)} Hz`);
    if (n.excitatory) lines.push(`last chosen: ${lastChosen.get(i) ?? '–'}`);
    return lines.join('\n');
  }
  function showTip(i) {
    hovered = i;
    tip.hidden = false;
    tip.style.whiteSpace = 'pre';
    tip.textContent = tipText(i);
    const r = svg.getBoundingClientRect(), pr = tip.offsetParent?.getBoundingClientRect() || r;
    tip.style.left = `${r.left - pr.left + (nodes[i].x / 800) * r.width + 14}px`;
    tip.style.top = `${r.top - pr.top + (nodes[i].y / 600) * r.height - 10}px`;
  }
  function hideTip() { hovered = -1; tip.hidden = true; }

  function spawn(pe, op) {
    if (!pe.len || reduced()) { pe.flashUntil = performance.now() + 120; return; }
    const dot = el('circle', { r: 3, class: 'dot', style: `opacity:${op}` }, gLayer);
    particles.push({ dot, pe, t0: performance.now(), dur: Math.max(150, 60 * pe.dSteps) });
    if (particles.length > MAX_PARTICLES) particles.shift().dot.remove();
  }

  function tick() {
    raf = 0;
    const now = performance.now();
    let busy = false;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i], f = (now - p.t0) / p.dur;
      if (f >= 1) { p.dot.remove(); particles.splice(i, 1); continue; }
      const pt = p.pe.path.getPointAtLength(f * p.pe.len);
      p.dot.setAttribute('cx', pt.x); p.dot.setAttribute('cy', pt.y);
      busy = true;
    }
    for (const pe of paths.values()) {
      const on = now < pe.flashUntil;
      if (on !== pe.on) { pe.on = on; pe.path.classList.toggle('flash', on); }
      busy ||= on;
    }
    for (const nd of nodes) {
      const on = now < nd.until;
      if (on !== nd.on) { nd.on = on; nd.g.classList.toggle('spk', on); }
      busy ||= on;
    }
    if (busy) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function render(frame) {
    if (!net) return;
    const sim = getSim(), st = sim?.state, now = performance.now();
    const decay = Math.exp(-((frame.stepsRun || 0) * DT) / 500);
    const cnt = new Float32Array(nodes.length);
    for (const i of frame.spikes || []) { cnt[i]++; nodes[i].until = now + 120; }
    const theta = store.get().params.theta;
    nodes.forEach((nd, i) => {
      nd.rate = nd.rate * decay + (cnt[i] * 1000) / 500;
      if (!st) return;
      const pct = Math.round(Math.min(1, Math.max(0, st.S[i] / theta)) * 20) * 5; // 5% steps: fewer attr writes
      const fill = `color-mix(in srgb, var(--${nd.cls}) ${pct}%, var(--surface-2))`;
      if (fill !== nd.fill) { nd.fill = fill; nd.shape.style.fill = fill; }
    });
    for (const r of frame.routes || []) {
      lastChosen.set(r.src, net.collaterals[r.src][r.k]?.id);
      if (store.get().params.routing === 'soft') {
        net.collaterals[r.src].forEach((c, k) => { const pe = paths.get(`${r.src}:${k}`); if (pe && r.p[k] > 0.02) spawn(pe, r.p[k]); });
      } else { const pe = paths.get(`${r.src}:${r.k}`); if (pe) spawn(pe, 1); }
    }
    if (frame.pixelSpikes) cells.forEach((c, i) => { const on = frame.pixelSpikes[i] ? 1 : 0; if (on !== c._on) { c._on = on; c.classList.toggle('on', !!on); } });
    if (frame.spikes?.length) spikesSec.push([now, frame.spikes.length]);
    kick();
    if (hovered >= 0) tip.textContent = tipText(hovered);
    if (now - lastLabel >= 500 && st) { // aria-labels at most 2x/s
      lastLabel = now;
      nodes.forEach((nd, i) => {
        const n = nd.n, o = n.o >= 0 ? `, ${ORI[n.o]}` : '';
        const label = `${n.id}, ${LAYER_NAME[LAYER_OF(n.pop)]} ${n.excitatory ? 'excitatory' : CLS_NAME[nd.cls]}${o}, ${st.S[i].toFixed(1)} mV`;
        if (label !== nd.label) { nd.label = label; nd.g.setAttribute('aria-label', label); }
      });
    }
    if (now - lastSvgLabel >= 1000) {
      lastSvgLabel = now;
      spikesSec = spikesSec.filter((s) => now - s[0] < 1000);
      svg.setAttribute('aria-label', `Microcircuit activity: ${spikesSec.reduce((a, s) => a + s[1], 0)} spikes in last second`);
    }
  }

  if (getNetwork()) setNetwork(getNetwork());
  bus.on('reset', () => { const n = getNetwork(); if (n) setNetwork(n); });
  return { render, setNetwork, destroy() { cancelAnimationFrame(raf); gLayer?.remove(); } };
}
