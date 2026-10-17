import { mulberry32, streamSeed, STREAM } from './rng.js';

const N = 16;
// 'custom' (drawn) comes from rasterize(), not makePreset.
export const PRESET_IDS = Object.freeze(['blank', 'white', 'vbar', 'hbar', 'diag45', 'diag135', 'checker', 'digit1', 'digit7', 'digit0', 'noise']);

const RULES = {
  blank: () => 0,
  white: () => 1,
  vbar: (x, y) => (x === 7 || x === 8) && y >= 2 && y <= 13,
  hbar: (x, y) => (y === 7 || y === 8) && x >= 2 && x <= 13,
  diag45: (x, y) => (x + y === 14 || x + y === 15) && x >= 2 && x <= 13,
  diag135: (x, y) => (x - y === 0 || x - y === 1) && x >= 2 && x <= 13,
  checker: (x, y) => (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0,
  digit1: (x, y) => ((x === 8 || x === 9) && y >= 2 && y <= 13) || (y === 13 && x >= 6 && x <= 11) || (x === 7 && y === 3) || (x === 6 && y === 4),
  digit7: (x, y) => {
    if ((y === 2 || y === 3) && x >= 3 && x <= 12) return true;
    if (y < 4 || y > 13) return false;
    const x0 = Math.round(12 - 0.6 * (y - 3));
    return x === x0 || x === x0 + 1;
  },
  digit0: (x, y) => {
    const r = ((x - 7.5) / 4.5) ** 2 + ((y - 7.5) / 6) ** 2;
    return r >= 0.55 && r <= 1.0;
  },
};

export function makePreset(id, seed) {
  const img = new Float32Array(N * N);
  if (id === 'noise') {
    const rng = mulberry32(streamSeed(seed, STREAM.NOISE_PRESET));
    for (let p = 0; p < img.length; p++) img[p] = rng() < 0.5 ? 1 : 0;
    return img;
  }
  const rule = RULES[id];
  if (!rule) throw new Error('unknown preset: ' + id);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) img[y * N + x] = rule(x, y) ? 1 : 0;
  return img;
}

// Area-average luminance (alpha ignored) of each w/16 × h/16 block; non-divisible sizes use floor edges.
export function rasterize(rgba, w, h) {
  const out = new Float32Array(N * N);
  for (let by = 0; by < N; by++) {
    const y0 = Math.floor((by * h) / N), y1 = Math.max(y0 + 1, Math.floor(((by + 1) * h) / N));
    for (let bx = 0; bx < N; bx++) {
      const x0 = Math.floor((bx * w) / N), x1 = Math.max(x0 + 1, Math.floor(((bx + 1) * w) / N));
      let s = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        s += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      }
      out[by * N + bx] = Math.min(1, Math.max(0, s / ((y1 - y0) * (x1 - x0) * 255)));
    }
  }
  return out;
}

export function effectiveIntensity(img, c, sigmaPx, z) {
  const out = new Float32Array(img.length);
  for (let p = 0; p < img.length; p++) out[p] = Math.min(1, Math.max(0, 0.5 + c * (img[p] - 0.5) + sigmaPx * z[p]));
  return out;
}
