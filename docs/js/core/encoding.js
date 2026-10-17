export function rates(intensity, rBase, rMax) {
  const out = new Float32Array(intensity.length);
  for (let p = 0; p < out.length; p++) out[p] = rBase + (rMax - rBase) * intensity[p];
  return out;
}

const S = Math.SQRT1_2;
const E = [[0, 1], [1, 0], [S, -S], [S, S]]; // vertical, horizontal, diag45, diag135

export function makeKernel(o, offset) {
  const [ex, ey] = E[o];
  const nx = -ey, ny = ex;
  const k = new Float32Array(256);
  let pos = 0, neg = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const qx = x - 7.5, qy = y - 7.5;
    const u = qx * nx + qy * ny - offset, v = qx * ex + qy * ey;
    const val = Math.exp(-v * v / 72) * (Math.exp(-u * u / (2 * 1.44)) - 0.5 * Math.exp(-u * u / 18));
    k[y * 16 + x] = val;
    if (val > 0) pos += val; else neg += val;
  }
  for (let p = 0; p < 256; p++) k[p] = k[p] > 0 ? k[p] / pos : k[p] / -neg;
  return k;
}
