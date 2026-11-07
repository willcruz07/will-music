const twiddleCache = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>();

const getTables = (size: number) => {
  const cached = twiddleCache.get(size);
  if (cached) return cached;
  if (size < 2 || (size & (size - 1)) !== 0) throw new RangeError('FFT size must be a power of two');
  const cos = new Float64Array(size / 2);
  const sin = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / size);
    sin[i] = -Math.sin((2 * Math.PI * i) / size);
  }
  const bits = Math.log2(size);
  const rev = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const tables = { cos, sin, rev };
  twiddleCache.set(size, tables);
  return tables;
};

/**
 * Forward real FFT with the numpy convention X[k] = Σ x[n]·e^(−2πikn/N).
 * Writes size/2 + 1 complex bins into `out` as interleaved re/im (length size + 2).
 * `re`/`im` are caller-provided scratch buffers of length `size`.
 */
export const rfft = (
  input: Float32Array,
  out: Float32Array,
  re: Float64Array,
  im: Float64Array,
): void => {
  const size = input.length;
  const { cos, sin, rev } = getTables(size);
  for (let i = 0; i < size; i++) {
    re[rev[i]!] = input[i]!;
    im[rev[i]!] = 0;
  }
  for (let len = 2; len <= size; len <<= 1) {
    const half = len >> 1;
    const stride = size / len;
    for (let start = 0; start < size; start += len) {
      for (let j = 0; j < half; j++) {
        const wr = cos[j * stride]!;
        const wi = sin[j * stride]!;
        const a = start + j;
        const b = a + half;
        const xr = re[b]! * wr - im[b]! * wi;
        const xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
    }
  }
  for (let k = 0; k <= size / 2; k++) {
    out[2 * k] = re[k]!;
    out[2 * k + 1] = im[k]!;
  }
};
