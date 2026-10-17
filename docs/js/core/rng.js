import { fnv1a32 } from './hash.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function streamSeed(seed, salt) {
  return fnv1a32(String(seed >>> 0) + ':' + salt);
}

export function gauss(rng) {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2);
}

export const STREAM = Object.freeze({
  TOPOLOGY: 'topology', STIM: 'stim', INPUT: 'input', TOPDOWN: 'topdown',
  NOISE: 'noise', SPIKE: 'spike', ROUTE: 'route', EMULATOR: 'emulator',
  NOISE_PRESET: 'noisePreset', UI: 'ui',
});
