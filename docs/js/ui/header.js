import { parseSeed } from '../core/params.js';
import { cycleTheme } from './theme.js';

const SPEEDS = [10, 25, 50, 100, 250, 500, 1000];
const MODES = { sim: 'SIMULATED', replay: 'REPLAY', live: 'LIVE' };
const BADGE = { SIMULATED: 'SIMULATED JEV', REPLAY: 'REPLAY JEV', LIVE: 'LIVE JEV' };
const NO_PROXY = 'Unavailable: run the local proxy (node tools/jev-proxy.mjs)';
const PITCH = "Score → Noul → spike → Choice: a cortical microcircuit built from JEV's typed primitives.";

export function initHeader(store, bus) {
  const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
  const seedInput = $('seed-input'), slider = $('speed-slider');
  $('pitch').textContent = PITCH;

  const setRun = (run) => { store.set({ run }); bus.emit('run:changed', { run }); };
  const reset = () => {
    const runId = store.get().runId + 1;
    store.set({ runId, run: store.get().run === 'running' ? 'running' : 'idle' });
    bus.emit('reset', { runId });
  };
  const applySeed = (seed) => {
    store.set({ seed });
    const u = new URL(location.href);
    u.searchParams.set('seed', seed);
    try { history.replaceState(null, '', u); } catch { /* sandboxed */ }
    reset();
  };

  for (const [k, mode] of Object.entries(MODES)) {
    $(`mode-select-${k}`).addEventListener('click', (e) => {
      if (e.currentTarget.disabled) return;
      store.set({ mode });
      bus.emit('mode:changed', { mode });
    });
  }
  $('btn-play').addEventListener('click', () => setRun(store.get().run === 'running' ? 'paused' : 'running'));
  $('btn-step').addEventListener('click', () => { setRun('paused'); bus.emit('step', {}); });
  $('btn-reset').addEventListener('click', reset);
  $('btn-theme').addEventListener('click', () => cycleTheme(store));
  $('btn-key').addEventListener('click', () => bus.emit('key:open', {}));
  $('btn-about').addEventListener('click', () => bus.emit('about:open', {}));
  slider.addEventListener('input', () => store.set({ speed: SPEEDS[slider.value] }));
  $('btn-seed-apply').addEventListener('click', () => {
    const r = parseSeed(seedInput.value);
    if (r.ok) applySeed(r.seed); else bus.emit('banner', { level: 'error', text: r.error });
  });
  $('btn-seed-random').addEventListener('click', () => applySeed(crypto.getRandomValues(new Uint32Array(1))[0]));

  // title carries the tooltip text (tests assert title)
  const setDis = (el, off, title) => {
    el.disabled = off;
    if (off) el.title = title; else el.removeAttribute('title');
  };
  const render = (s) => {
    $('mode-badge').textContent = BADGE[s.mode] + (s.mode === 'REPLAY' && s.unrecorded > 0 ? ` · ${s.unrecorded} unrecorded` : '');
    for (const [k, mode] of Object.entries(MODES)) $(`mode-select-${k}`).setAttribute('aria-pressed', String(s.mode === mode));
    setDis($('mode-select-replay'), !s.availability.replay, 'No recording available');
    setDis($('mode-select-live'), !s.availability.live || s.budget.used >= s.budget.cap,
      s.availability.live ? 'LIVE budget used up' : NO_PROXY);
    setDis($('btn-key'), !s.availability.live, NO_PROXY);
    const play = $('btn-play');
    play.textContent = s.run === 'running' ? 'Pause' : 'Play';
    play.setAttribute('aria-pressed', String(s.run === 'running'));
    $('jev-budget').textContent = `LIVE calls: ${s.budget.used} / ${s.budget.cap}`;
    $('btn-theme').textContent = `Theme: ${s.theme}`;
    if (document.activeElement !== seedInput) seedInput.value = String(s.seed);
    slider.value = String(Math.max(0, SPEEDS.indexOf(s.speed)));
    $('sim-time').dataset.run = s.run;
  };
  store.subscribe(render);
  render(store.get());
}
