import { SEPARATION_GEOMETRY } from './stft.ts';

export type ChunkPlan = { start: number; length: number }[];

/** Chunk starts with `overlap` between neighbours; the last chunk always reaches the end. */
export const planChunks = (totalSamples: number, chunkSamples: number = SEPARATION_GEOMETRY.chunkSamples, overlap = 0.25): ChunkPlan => {
  if (totalSamples <= chunkSamples) return [{ start: 0, length: totalSamples }];
  const step = Math.round(chunkSamples * (1 - overlap));
  const plan: ChunkPlan = [];
  for (let start = 0; ; start += step) {
    const length = Math.min(chunkSamples, totalSamples - start);
    plan.push({ start, length });
    if (start + length >= totalSamples) break;
  }
  return plan;
};

/** Planar [channels × chunkSamples] window of a planar signal, zero-padded past the end. */
export const sliceChunk = (planar: Float32Array, totalSamples: number, start: number, chunkSamples: number, channels = 2): Float32Array => {
  const out = new Float32Array(channels * chunkSamples);
  const length = Math.max(0, Math.min(chunkSamples, totalSamples - start));
  for (let c = 0; c < channels; c++) out.set(planar.subarray(c * totalSamples + start, c * totalSamples + start + length), c * chunkSamples);
  return out;
};

/**
 * Accumulates per-chunk stem outputs with linear cross-fades on the overlaps; the result is the
 * weighted average, so an identity model reproduces the input exactly.
 */
export const createStemAccumulator = (totalSamples: number, stems: number, channels = 2) => {
  const sums = Array.from({ length: stems }, () => new Float64Array(channels * totalSamples));
  const weights = new Float64Array(totalSamples);
  return {
    add(index: number, plan: ChunkPlan, outputs: Float32Array[]) {
      const { start, length } = plan[index]!;
      const chunkSamples = outputs[0]!.length / channels;
      const left = index > 0 ? plan[index - 1]!.start + plan[index - 1]!.length - start : 0;
      const right = index < plan.length - 1 ? start + length - plan[index + 1]!.start : 0;
      for (let p = 0; p < length; p++) {
        let w = 1;
        if (left > 0 && p < left) w = Math.min(w, (p + 1) / (left + 1));
        if (right > 0 && p >= length - right) w = Math.min(w, (length - p) / (right + 1));
        weights[start + p] = weights[start + p]! + w;
        for (let s = 0; s < stems; s++) {
          const out = outputs[s]!;
          const sum = sums[s]!;
          for (let c = 0; c < channels; c++) sum[c * totalSamples + start + p] = sum[c * totalSamples + start + p]! + w * out[c * chunkSamples + p]!;
        }
      }
    },
    finish(): Float32Array[] {
      return sums.map((sum) => {
        const out = new Float32Array(sum.length);
        for (let i = 0; i < sum.length; i++) out[i] = sum[i]! / Math.max(weights[i % totalSamples]!, 1e-12);
        return out;
      });
    },
  };
};

export const deriveStems = (mix: Float32Array, vocals: Float32Array, backing: Float32Array) => {
  const instrumental = new Float32Array(mix.length);
  const lead = new Float32Array(mix.length);
  for (let i = 0; i < mix.length; i++) {
    instrumental[i] = mix[i]! - vocals[i]!;
    lead[i] = vocals[i]! - backing[i]!;
  }
  return { instrumental, lead, backing };
};

/** Decoded channels → planar stereo (mono is duplicated; extra channels are dropped). */
export const toStereoPlanar = (channels: Float32Array[]): { planar: Float32Array; samples: number } => {
  const left = channels[0] ?? new Float32Array(0);
  const right = channels[1] ?? left;
  const samples = left.length;
  const planar = new Float32Array(2 * samples);
  planar.set(left, 0);
  planar.set(right.subarray(0, samples), samples);
  return { planar, samples };
};
