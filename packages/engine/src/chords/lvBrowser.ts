// Browser inference helpers for LV-Chordia. Filter banks/dictionary are generated from the MIT upstream.
import { rfft } from '../cqt/fft.ts';
import type { ChordSegment } from './decode.ts';

export type LvPlan = {
  tuning: number;
  levels: { parent: number; factor: number; taps: number[] }[];
  groups: { level: number; fft: number; hop: number; pseudo: boolean; offsets: number[]; bins: number[]; real: number[]; imag: number[]; rows: number; start: number; scales: number[] }[];
};
export type LvCandidate = { raw: string; label: string; indices: number[] };
export const LV_WIDTHS = [73, 13, 4, 4, 3, 3] as const;

const spectrum = (size: number) => ({ frame: new Float32Array(size), bins: new Float32Array(size + 2), re: new Float64Array(size), im: new Float64Array(size) });
const transform = (pcm: Float32Array, center: number, scratch: ReturnType<typeof spectrum>, hann: boolean) => {
  const size = scratch.frame.length;
  for (let i = 0; i < size; i++) {
    const value = pcm[center + i - size / 2] ?? 0;
    scratch.frame[i] = hann ? value * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / size)) : value;
  }
  rfft(scratch.frame, scratch.bins, scratch.re, scratch.im);
};

/** Librosa-style peak interpolation and 0.01-bin tuning histogram; fixed 22.05 kHz / 36 bins per octave. */
export const estimateLvTuning = (pcm: Float32Array): number => {
  const scratch = spectrum(2048);
  const magnitude = new Float32Array(1025);
  const peaks: { pitch: number; magnitude: number }[] = [];
  for (let center = 0; center <= pcm.length; center += 512) {
    transform(pcm, center, scratch, true);
    let max = 0;
    for (let k = 0; k < magnitude.length; k++) { magnitude[k] = Math.hypot(scratch.bins[2 * k]!, scratch.bins[2 * k + 1]!); max = Math.max(max, magnitude[k]!); }
    for (let k = Math.ceil(150 * 2048 / 22050); k < 4000 * 2048 / 22050; k++) {
      const value = magnitude[k]!;
      if (value <= 0.1 * max || value <= magnitude[k - 1]! || value < magnitude[k + 1]!) continue;
      const gradient = (magnitude[k + 1]! - magnitude[k - 1]!) / 2;
      const curvature = magnitude[k - 1]! + magnitude[k + 1]! - 2 * value;
      const offset = Math.abs(gradient) >= Math.abs(curvature) ? 0 : -gradient / curvature;
      peaks.push({ pitch: (k + offset) * 22050 / 2048, magnitude: value + 0.5 * gradient * offset });
    }
  }
  if (!peaks.length) return 0;
  const sorted = peaks.map((peak) => peak.magnitude).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const threshold = sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  const histogram = new Uint32Array(100);
  for (const peak of peaks) {
    if (peak.magnitude < threshold) continue;
    let residual = ((36 * Math.log2(peak.pitch / 440)) % 1 + 1) % 1;
    if (residual >= 0.5) residual--;
    const bin = Math.max(0, Math.min(99, Math.floor((residual + 0.5) * 100)));
    histogram[bin] = histogram[bin]! + 1;
  }
  let best = 0;
  for (let i = 1; i < 100; i++) if (histogram[i]! > histogram[best]!) best = i;
  return -0.5 + best / 100;
};

/** Hybrid CQT using precomputed sparse filter banks and scipy-compatible polyphase downsampling. */
export const computeLvFeatures = (pcm: Float32Array, plan: LvPlan, onProgress?: (done: number, total: number) => void): { data: Float32Array; frames: number } => {
  const levels = [pcm];
  for (const level of plan.levels) {
    const source = levels[level.parent];
    if (!source) throw new Error('Plano CQT inválido.');
    const target = new Float32Array(Math.ceil(source.length / level.factor));
    const half = (level.taps.length - 1) / 2;
    for (let i = 0; i < target.length; i++) {
      let sum = 0;
      for (let tap = 0; tap < level.taps.length; tap++) sum += (source[i * level.factor + half - tap] ?? 0) * Math.fround(level.taps[tap]!);
      target[i] = sum * Math.sqrt(level.factor);
    }
    levels.push(target);
  }
  const frames = Math.min(...plan.groups.map((group) => 1 + Math.floor(levels[group.level]!.length / group.hop)));
  const data = new Float32Array(frames * 252);
  for (const [index, group] of plan.groups.entries()) {
    const scratch = spectrum(group.fft);
    const source = levels[group.level]!;
    const magnitudes = new Float32Array(group.fft / 2 + 1);
    for (let frame = 0; frame < frames; frame++) {
      transform(source, frame * group.hop, scratch, group.pseudo);
      if (group.pseudo) for (let bin = 0; bin < magnitudes.length; bin++) magnitudes[bin] = Math.hypot(scratch.bins[bin * 2]!, scratch.bins[bin * 2 + 1]!);
      for (let row = 0; row < group.rows; row++) {
        const bin = group.start + row - 18;
        if (bin < 0 || bin >= 252) continue;
        let re = 0, im = 0;
        for (let j = group.offsets[row]!; j < group.offsets[row + 1]!; j++) {
          const frequency = group.bins[j]!;
          if (group.pseudo) re += group.real[j]! * magnitudes[frequency]!;
          else {
            const xr = scratch.bins[frequency * 2]!, xi = scratch.bins[frequency * 2 + 1]!;
            re += group.real[j]! * xr - group.imag[j]! * xi;
            im += group.real[j]! * xi + group.imag[j]! * xr;
          }
        }
        data[frame * 252 + bin] = Math.hypot(re, im) * group.scales[row]!;
      }
    }
    onProgress?.(index + 1, plan.groups.length);
  }
  return { data, frames };
};

/** Port of the upstream uniform-transition Viterbi decoder, with a compact backtracking table. */
export const decodeLvChords = (probabilities: readonly Float32Array[], frames: number, candidates: readonly LvCandidate[]): ChordSegment[] => {
  if (probabilities.length !== 6 || probabilities.some((values, i) => values.length !== frames * LV_WIDTHS[i]!) || !candidates.length || frames < 1) throw new Error('Previsões LV-Chordia inválidas.');
  const count = candidates.length;
  // Each head/class log is reused by thousands of candidates. Float64 preserves the previous arithmetic.
  const logProbabilities = probabilities.map((values) => Float64Array.from(values, (value) => Math.log(value)));
  let previous = new Float64Array(count).fill(-Infinity);
  let current = new Float64Array(count);
  const predecessors = new Int32Array(frames * count);
  let best = 0;
  for (let frame = 0; frame < frames; frame++) {
    const transition = frame === 0 ? -Infinity : previous[best]! - 30;
    let nextBest = 0;
    for (let chord = 0; chord < count; chord++) {
      let observation = 0;
      const indices = candidates[chord]!.indices;
      for (let head = 0; head < 6; head++) {
        const position = indices[head]!;
        if (position >= 0) observation += logProbabilities[head]![frame * LV_WIDTHS[head]! + position]!;
      }
      const stay = previous[chord]!;
      const keep = stay > transition;
      current[chord] = (frame === 0 ? (chord === 0 ? 0 : -Infinity) : Math.max(stay, transition)) + observation;
      predecessors[frame * count + chord] = frame === 0 ? -1 : keep ? chord : best;
      if (current[chord]! > current[nextBest]!) nextBest = chord;
    }
    best = nextBest;
    [previous, current] = [current, previous];
  }
  const path = new Int32Array(frames);
  path[frames - 1] = best;
  for (let frame = frames - 2; frame >= 0; frame--) path[frame] = predecessors[(frame + 1) * count + path[frame + 1]!]!;
  const segments: ChordSegment[] = [];
  let start = 0;
  for (let frame = 0; frame < frames; frame++) {
    if (frame + 1 < frames && path[frame + 1] === path[frame]) continue;
    const chord = candidates[path[frame]!]!;
    segments.push({ start: start * 512 / 22050, end: (frame + 1) * 512 / 22050, raw: chord.raw, label: chord.label });
    start = frame + 1;
  }
  return segments;
};
