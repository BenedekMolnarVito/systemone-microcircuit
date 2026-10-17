import { DT } from './params.js';

const MAX_WALL_DELTA_MS = 100;
const MAX_STEPS = 400;

// NFR-PERF-02: fixed-step accumulator
export function computeSteps(acc, wallDeltaMs, speed) {
  acc += Math.min(wallDeltaMs, MAX_WALL_DELTA_MS) * speed / 1000;
  const steps = Math.floor(acc / DT);
  if (steps > MAX_STEPS) return { steps: MAX_STEPS, acc: 0, capped: true };
  return { steps, acc: acc - steps * DT, capped: false };
}
