import { PRESET_IDS, makePreset, rasterize, effectiveIntensity } from '../core/stimuli.js';
import { bindParam } from './params-panel.js';

const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const LABELS = { blank: 'Blank', white: 'All white', vbar: 'Vertical bar', hbar: 'Horizontal bar', diag45: 'Diagonal /', diag135: 'Diagonal \\', checker: 'Checkerboard', digit1: 'Glyph 1', digit7: 'Glyph 7', digit0: 'Glyph 0', noise: 'Noise' };
const ZERO = new Float32Array(256);

function paint(canvas, img) {
  const ctx = canvas.getContext('2d');
  const cell = canvas.width / 16;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const g = Math.round(img[y * 16 + x] * 255);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x * cell, y * cell, cell, cell);
  }
}

export function initInputPanel(store, bus) {
  const grid = document.getElementById('stimulus-presets');
  const preview = q('stimulus-preview');
  const draw = q('draw-canvas');
  const cycle = q('cycle-toggle');
  const buttons = {}, thumbs = {};

  const select = (id, img) => {
    store.set({ stimulus: { id, img } });
    bus.emit('stimulus:changed', { id });
  };
  for (const id of PRESET_IDS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-testid', `stimulus-preset-${id}`);
    b.title = LABELS[id];
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    c.setAttribute('aria-hidden', 'true');
    const span = document.createElement('span');
    span.textContent = LABELS[id];
    b.append(c, span);
    b.addEventListener('click', () => select(id, makePreset(id, store.get().seed)));
    grid.append(b);
    buttons[id] = b; thumbs[id] = c;
  }

  const bind = (id, key) => bindParam(store, bus, q(id), key, q(`${id}-value`));
  const syncs = [bind('contrast-slider', 'contrast'), bind('pixel-noise-slider', 'pixelNoise'), bind('rate-max-slider', 'rMax')];
  // store.cycle is not in SPEC 5.3: T15 reads it to rotate vbar→hbar→diag45→diag135 every 2000 ms sim.
  cycle.addEventListener('change', () => store.set({ cycle: cycle.checked }));

  let lastSeed = null;
  const sync = () => {
    const s = store.get();
    if (s.seed !== lastSeed) {
      lastSeed = s.seed;
      for (const id of PRESET_IDS) paint(thumbs[id], makePreset(id, s.seed));
      // noise preset depends on seed; id unchanged so no bus event.
      if (s.stimulus.id === 'noise') { store.set({ stimulus: { id: 'noise', img: makePreset('noise', s.seed) } }); return; }
    }
    for (const id of PRESET_IDS) buttons[id].setAttribute('aria-pressed', String(s.stimulus.id === id));
    paint(preview, effectiveIntensity(s.stimulus.img, s.params.contrast, 0, ZERO));
    syncs.forEach((f) => f());
    cycle.checked = !!s.cycle;
  };

  // Drawing: white brush paints, erase paints black; "use" rasterises to 16x16.
  const ctx = draw.getContext('2d');
  const clear = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, draw.width, draw.height); };
  clear();
  let erase = false, last = null;
  const bd = q('brush-draw'), be = q('brush-erase');
  const setBrush = (e) => {
    erase = e;
    bd.setAttribute('aria-pressed', String(!e));
    be.setAttribute('aria-pressed', String(e));
  };
  bd.addEventListener('click', () => setBrush(false));
  be.addEventListener('click', () => setBrush(true));
  const stroke = (ev) => {
    const r = draw.getBoundingClientRect();
    const p = [(ev.clientX - r.left) * draw.width / r.width, (ev.clientY - r.top) * draw.height / r.height];
    ctx.strokeStyle = erase ? '#000' : '#fff';
    ctx.lineWidth = 14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...(last ?? p)); ctx.lineTo(...p); ctx.stroke();
    last = p;
  };
  draw.addEventListener('pointerdown', (ev) => { draw.setPointerCapture?.(ev.pointerId); last = null; stroke(ev); });
  draw.addEventListener('pointermove', (ev) => { if (ev.buttons) stroke(ev); });
  const end = () => { last = null; };
  draw.addEventListener('pointerup', end);
  draw.addEventListener('pointercancel', end);
  q('btn-draw-clear').addEventListener('click', clear);
  q('btn-draw-use').addEventListener('click', () => {
    const d = ctx.getImageData(0, 0, draw.width, draw.height);
    select('custom', rasterize(d.data, d.width, d.height));
  });

  store.subscribe(sync);
  sync();
}
