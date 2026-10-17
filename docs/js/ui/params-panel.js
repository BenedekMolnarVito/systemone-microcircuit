import { clampParams, DEFAULTS } from '../core/params.js';

const q = (id) => document.querySelector(`[data-testid="${id}"]`);

// Shared with input-panel: binds a control to store.params[key]; returns sync() pushing store → DOM.
export function bindParam(store, bus, el, key, out) {
  const bool = el.type === 'checkbox';
  const read = () => (bool ? el.checked : el.tagName === 'SELECT' ? el.value : Number(el.value));
  el.addEventListener(bool || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    if (el.type === 'number' && el.value === '') return;
    const patch = clampParams({ [key]: read() });
    if (!Object.keys(patch).length) return;
    const s = store.get();
    const next = { params: { ...s.params, ...patch } };
    if ('budget' in patch) next.budget = { ...s.budget, cap: patch.budget };
    store.set(next);
    bus.emit('params:changed', { patch });
  });
  return () => {
    const v = store.get().params[key];
    if (bool) el.checked = v; else el.value = v;
    if (out) out.textContent = String(+Number(v).toFixed(2));
  };
}

const SLIDERS = ['tauM', 'theta', 'delta', 'sigmaV', 'g', 'tauC', 'attention', 'jevIntervalMs', 'liveMinIntervalMs'];
const OTHERS = ['pvMode', 'stdp', 'jevControl', 'autoJev', 'budget'];

export function initParamsPanel(store, bus) {
  const panel = q('params-panel');
  if (panel && window.matchMedia?.('(max-width: 767px)').matches) panel.open = false;
  const syncs = [];
  for (const k of SLIDERS) syncs.push(bindParam(store, bus, q(`param-${k}`), k, q(`param-${k}-value`)));
  for (const k of OTHERS) syncs.push(bindParam(store, bus, q(`param-${k}`), k));
  const radios = { hard: q('routing-hard'), soft: q('routing-soft') };
  for (const [v, el] of Object.entries(radios)) {
    el.addEventListener('change', () => {
      if (!el.checked) return;
      const patch = clampParams({ routing: v });
      store.set({ params: { ...store.get().params, ...patch } });
      bus.emit('params:changed', { patch });
    });
  }
  const sync = () => {
    syncs.forEach((f) => f());
    radios[store.get().params.routing].checked = true;
  };
  store.subscribe(sync);
  sync();
  // Restore all DEFAULTS except seed and speed (header-owned); mode lives outside params.
  q('btn-params-default').addEventListener('click', () => {
    const { seed, speed, ...patch } = DEFAULTS;
    const s = store.get();
    store.set({ params: { ...s.params, ...patch }, budget: { ...s.budget, cap: patch.budget } });
    bus.emit('params:changed', { patch });
  });
}
