// CPU port of the Musetric separation shaders (frame, pack, applyMasks, overlapAdd); MIT, commit
// f37b6b1b054e08db0ec4411479b8092524d6dac2. See THIRD_PARTY_NOTICES.md.
import { irfft, rfft } from '../cqt/fft.ts';

export const SEPARATION_GEOMETRY = { nFft: 2048, hop: 441, frames: 1100, channels: 2, chunkSamples: 441 * 1099, sampleRate: 44100 } as const;

const { nFft, hop, frames, channels, chunkSamples } = SEPARATION_GEOMETRY;
const pad = nFft / 2;
const bins = nFft / 2 + 1;
const packedBins = bins * channels;
const plane = packedBins * frames * 2;

const hann = (() => {
  const w = new Float32Array(nFft);
  for (let n = 0; n < nFft; n++) w[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / nFft);
  return w;
})();

const reflect = (i: number, length: number): number => {
  if (i < 0) return -i;
  if (i >= length) return 2 * length - 2 - i;
  return i;
};

/** Planar stereo chunk [2 × chunkSamples] → `stft_repr` [2050 × 1100 × 2] (packed = freq·2 + channel). */
export const stftChunk = (planar: Float32Array): Float32Array => {
  const out = new Float32Array(plane);
  const frame = new Float32Array(nFft);
  const spectrum = new Float32Array(nFft + 2);
  const re = new Float64Array(nFft);
  const im = new Float64Array(nFft);
  for (let c = 0; c < channels; c++) {
    const base = c * chunkSamples;
    for (let f = 0; f < frames; f++) {
      for (let n = 0; n < nFft; n++) frame[n] = planar[base + reflect(f * hop + n - pad, chunkSamples)]! * hann[n]!;
      rfft(frame, spectrum, re, im);
      for (let k = 0; k < bins; k++) {
        const dst = ((k * channels + c) * frames + f) * 2;
        out[dst] = spectrum[2 * k]!;
        out[dst + 1] = spectrum[2 * k + 1]!;
      }
    }
  }
  return out;
};

/** Multiplies the spectrum by the first `chained` complex masks ([masks × plane]). */
export const applyMasks = (stft: Float32Array, masks: Float32Array, chained: number): Float32Array => {
  const out = stft.slice();
  for (let m = 0; m < chained; m++) {
    const offset = m * plane;
    for (let i = 0; i < plane; i += 2) {
      const mr = masks[offset + i]!;
      const mi = masks[offset + i + 1]!;
      const r = out[i]!;
      const j = out[i + 1]!;
      out[i] = r * mr - j * mi;
      out[i + 1] = r * mi + j * mr;
    }
  }
  return out;
};

/** Packed spectrum → planar stereo chunk, windowed overlap-add normalized by Σw² (porte of overlapAdd.wgsl). */
export const istftChunk = (packed: Float32Array): Float32Array => {
  const out = new Float32Array(channels * chunkSamples);
  const paddedLength = chunkSamples + 2 * pad;
  const sum = new Float64Array(paddedLength);
  const envelope = new Float64Array(paddedLength);
  const spectrum = new Float32Array(nFft + 2);
  const frame = new Float32Array(nFft);
  const re = new Float64Array(nFft);
  const im = new Float64Array(nFft);
  for (let c = 0; c < channels; c++) {
    sum.fill(0);
    envelope.fill(0);
    for (let f = 0; f < frames; f++) {
      for (let k = 0; k < bins; k++) {
        const src = ((k * channels + c) * frames + f) * 2;
        spectrum[2 * k] = packed[src]!;
        spectrum[2 * k + 1] = packed[src + 1]!;
      }
      irfft(spectrum, frame, re, im);
      const start = f * hop;
      for (let n = 0; n < nFft; n++) {
        const w = hann[n]!;
        sum[start + n] = sum[start + n]! + frame[n]! * w;
        envelope[start + n] = envelope[start + n]! + w * w;
      }
    }
    const base = c * chunkSamples;
    for (let s = 0; s < chunkSamples; s++) out[base + s] = sum[s + pad]! / Math.max(envelope[s + pad]!, 1e-8);
  }
  return out;
};
