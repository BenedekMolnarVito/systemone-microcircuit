// JEV tick scheduler + bounded control (SPEC 3.3 FR-JEV-08/09, 3.4.3 FR-JEV-17/18). DOM-free; all times are SIM ms.
import { DT } from './params.js';
import { summarizeCircuit } from '../jev/summary.js';
import { circuitRequest } from '../jev/schema.js';

const CHANGE_DELAY_MS = 50;
const CHANGE_GRID_GAP_MS = 300;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// FR-JEV-17/18: answers -> {betaOutput, stdpM}; jevControl off -> neutral.
export function applyControl(answers, params) {
  if (!params?.jevControl) return { betaOutput: 0, stdpM: 1 };
  const s = answers?.circuit_evidence?.score;
  const nu = answers?.circuit_novelty?.noul;
  return {
    betaOutput: Number.isFinite(s) ? 1.0 * (clamp(s, 0, 4) / 4 - 0.5) : 0,
    stdpM: Number.isFinite(nu) ? 0.5 + clamp(nu, 0, 1) : 1,
  };
}

export function createScheduler({ sim, network, client, getParams, getStimulusId, getLocalLabel }) {
  let lastTickMs = 0, prevL4 = null, changeTick = null, skipGrid = null, lastChangeMs = null, epoch = 0, controlled = false;

  const apply = (result) => {
    if (!result?.response) return;
    const c = applyControl(result.response.answers, getParams());
    sim.setControl(c);
    controlled = true;
  };

  function tick(tMs) {
    const windowMs = tMs - lastTickMs;
    lastTickMs = tMs;
    const summary = summarizeCircuit(sim, network, windowMs, prevL4, getStimulusId(), getLocalLabel());
    prevL4 = summary.l4_rates_hz;
    const r = client.ask('circuit', circuitRequest(summary), sim.t);
    if (typeof r?.then === 'function') {
      const e = epoch;
      r.then((res) => { if (e === epoch) apply(res); });
    } else apply(r); // sync answer: in effect from the next step
  }

  return {
    get lastTickMs() { return lastTickMs; },
    afterStep(n) {
      const p = getParams();
      if (!p.jevControl && controlled) { sim.setControl({ betaOutput: 0, stdpM: 1 }); controlled = false; }
      if (!p.autoJev) return;
      const t = (n + 1) * DT;
      const interval = p.jevIntervalMs;
      const onGrid = t % interval === 0;
      if (changeTick !== null && t >= changeTick) {
        changeTick = null;
        const nextGrid = (Math.floor(t / interval) + 1) * interval;
        if (nextGrid - t < CHANGE_GRID_GAP_MS) skipGrid = nextGrid;
        tick(t);
      } else if (onGrid && t !== skipGrid) tick(t);
    },
    // Debounce: a pending tick moves to the latest change + 50; a change < 300 ms after the previous one
    // whose tick already fired adds none (the grid tick catches up).
    onStimulusChange(id, tMs) {
      const debounced = lastChangeMs !== null && tMs - lastChangeMs < CHANGE_GRID_GAP_MS;
      lastChangeMs = tMs;
      if (changeTick !== null || !debounced) changeTick = tMs + CHANGE_DELAY_MS;
    },
    reset() {
      epoch++;
      lastTickMs = 0; prevL4 = null; changeTick = null; skipGrid = null; lastChangeMs = null; controlled = false;
      client.resetRun();
    },
  };
}
