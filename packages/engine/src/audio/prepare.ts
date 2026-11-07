export const ANALYSIS_SAMPLE_RATE = 22050;

export const downmixMean = (channels: readonly Float32Array[]): Float32Array => {
  const [first] = channels;
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first.slice();
  const out = new Float32Array(first.length);
  for (const channel of channels) {
    for (let i = 0; i < out.length; i++) out[i]! += channel[i] ?? 0;
  }
  for (let i = 0; i < out.length; i++) out[i]! /= channels.length;
  return out;
};

const KAISER_BETA = 8.6;
const ZERO_CROSSINGS = 32;
const TABLE_STEPS = 512;

const besselI0 = (x: number): number => {
  let sum = 1;
  let term = 1;
  const half = x / 2;
  for (let k = 1; k < 50; k++) {
    term *= (half / k) * (half / k);
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
};

const kernelCache = new Map<number, { table: Float32Array; halfWidth: number; cutoff: number }>();

// Windowed sinc h(x) = sinc(cutoff * x) * kaiser(x / halfWidth), x in input samples, tabulated for x >= 0.
const getKernel = (cutoff: number) => {
  const cached = kernelCache.get(cutoff);
  if (cached) return cached;
  const halfWidth = Math.ceil(ZERO_CROSSINGS / cutoff);
  const table = new Float32Array(halfWidth * TABLE_STEPS + 2);
  const i0Beta = besselI0(KAISER_BETA);
  for (let i = 0; i < table.length; i++) {
    const x = i / TABLE_STEPS;
    const u = x / halfWidth;
    if (u >= 1) {
      table[i] = 0;
      continue;
    }
    const arg = Math.PI * cutoff * x;
    const sinc = x === 0 ? 1 : Math.sin(arg) / arg;
    table[i] = sinc * (besselI0(KAISER_BETA * Math.sqrt(1 - u * u)) / i0Beta);
  }
  const kernel = { table, halfWidth, cutoff };
  kernelCache.set(cutoff, kernel);
  return kernel;
};

export const resample = (input: Float32Array, fromRate: number, toRate: number): Float32Array => {
  if (!(fromRate > 0) || !(toRate > 0)) throw new RangeError('Sample rates must be positive');
  if (fromRate === toRate) return input.slice();
  const outLength = Math.round((input.length * toRate) / fromRate);
  const out = new Float32Array(outLength);
  const cutoff = 0.95 * Math.min(1, toRate / fromRate);
  const { table, halfWidth } = getKernel(cutoff);
  const step = fromRate / toRate;
  for (let n = 0; n < outLength; n++) {
    const t = n * step;
    const center = Math.floor(t);
    const first = Math.max(0, center - halfWidth + 1);
    const last = Math.min(input.length - 1, center + halfWidth);
    let acc = 0;
    let weights = 0;
    for (let k = first; k <= last; k++) {
      const pos = Math.abs(t - k) * TABLE_STEPS;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const w = table[idx]! + (table[idx + 1]! - table[idx]!) * frac;
      acc += input[k]! * w;
      weights += w;
    }
    out[n] = weights !== 0 ? acc / weights : 0;
  }
  return out;
};

export const peakNormalize = (audio: Float32Array): Float32Array => {
  let peak = 0;
  for (const v of audio) peak = Math.max(peak, Math.abs(v));
  const out = audio.slice();
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i]! /= peak;
  return out;
};

export const prepareAnalysisAudio = (channels: readonly Float32Array[], sampleRate: number): Float32Array =>
  resample(downmixMean(channels), sampleRate, ANALYSIS_SAMPLE_RATE);
