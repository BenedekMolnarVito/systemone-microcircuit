import { parseSeed } from '../core/params.js';
import { cycleTheme } from './theme.js';

const SPEEDS = [10, 25, 50, 100, 250, 500, 1000];
const MODES = { sim: 'SIMULATED', replay: 'REPLAY', live: 'LIVE' };
const BADGE = { SIMULATED: 'SIMULATED JEV', REPLAY: 'REPLAY JEV', LIVE: 'LIVE JEV' };
const NO_PROXY = 'LIVE needs the local proxy: run "node tools/jev-proxy.mjs" and open http://127.0.0.1:8787'; // FR-JEV-05 exact
const NO_PROXY_KEY = 'Keys can only be used with the local proxy (node tools/jev-proxy.mjs)'; // SPEC E31 exact
// Enabled-state tooltips (README "Path A/B"); disabled states keep the SPEC-exact texts below.
const TIP = {
  sim: 'SIM: simulated JEV answers from a local formula over layer-4 rates; no key, no JEV network calls, no billing. Click to use it (the default). See About → Modes.',
  replay: 'REPLAY: plays back genuine JEV answers recorded earlier with the local proxy; no key, no billing. Click to use the bundled recording. See About → Modes.',
  live: 'LIVE: real JEV calls through the local proxy; needs a key (proxy environment or the Key button) and every call is billed, up to the LIVE budget. Click to switch. See About → Modes.',
  key: 'Enter, check or forget the JEV API key used by LIVE mode (K); it is sent only to the local proxy. See About → Modes.',
};
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

  // title carries the tooltip text (tests assert title); a hidden span repeats it for aria-describedby (§4.2)
  const setDis = (el, off, title, onTitle) => {
    el.disabled = off;
    const tipId = `${el.dataset.testid}-tip`;
    let tip = document.getElementById(tipId);
    if (!tip) { tip = document.createElement('span'); tip.id = tipId; tip.hidden = true; el.after(tip); }
    const t = off ? title : onTitle;
    el.title = t; tip.textContent = t; el.setAttribute('aria-describedby', tipId);
  };
  const render = (s) => {
    $('mode-badge').textContent = BADGE[s.mode] + (s.mode === 'REPLAY' && s.unrecorded > 0 ? ` · ${s.unrecorded} unrecorded` : '');
    for (const [k, mode] of Object.entries(MODES)) $(`mode-select-${k}`).setAttribute('aria-pressed', String(s.mode === mode));
    setDis($('mode-select-sim'), false, '', TIP.sim);
    setDis($('mode-select-replay'), !s.availability.replay, 'No JEV recording is bundled with this build', TIP.replay);
    setDis($('mode-select-live'), !s.availability.live || s.budget.used >= s.budget.cap,
      s.availability.live ? 'LIVE budget used up' : NO_PROXY, TIP.live);
    setDis($('btn-key'), !s.availability.live, NO_PROXY_KEY, TIP.key);
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
