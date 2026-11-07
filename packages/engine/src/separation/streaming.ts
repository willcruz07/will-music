import type { ChunkPlan } from './chunks.ts';

/** A finished stretch of every stem: planar [channels × (to − from)] each. */
export type FinalRegion = { from: number; to: number; stems: Float32Array[] };

/**
 * Same cross-faded average as createStemAccumulator, but it only keeps one chunk of state: after
 * chunk i is added, everything before chunk i+1 starts can no longer change and is handed out.
 * That lets a 6-stem separation be encoded as it runs instead of holding the whole song in memory.
 */
export const createStreamingAccumulator = (plan: ChunkPlan, totalSamples: number, stems: number, channels = 2) => {
  let base = 0;
  let sums: Float32Array[] = [];
  let weights = new Float32Array(0);
  return {
    add(index: number, outputs: Float32Array[]): FinalRegion {
      const { start, length } = plan[index]!;
      const chunkSamples = outputs[0]!.length / channels;
      if (!weights.length) {
        weights = new Float32Array(chunkSamples);
        sums = Array.from({ length: stems }, () => new Float32Array(channels * chunkSamples));
      }
      const left = index > 0 ? plan[index - 1]!.start + plan[index - 1]!.length - start : 0;
      const right = index < plan.length - 1 ? start + length - plan[index + 1]!.start : 0;
      const offset = start - base;
      for (let p = 0; p < length; p++) {
        let w = 1;
        if (left > 0 && p < left) w = Math.min(w, (p + 1) / (left + 1));
        if (right > 0 && p >= length - right) w = Math.min(w, (length - p) / (right + 1));
        const q = offset + p;
        weights[q] = weights[q]! + w;
        for (let s = 0; s < stems; s++) {
          const out = outputs[s]!;
          const sum = sums[s]!;
          for (let c = 0; c < channels; c++) sum[c * chunkSamples + q] = sum[c * chunkSamples + q]! + w * out[c * chunkSamples + p]!;
        }
      }
      const to = index < plan.length - 1 ? plan[index + 1]!.start : totalSamples;
      const done = to - base;
      const region: FinalRegion = { from: base, to, stems: [] };
      for (const sum of sums) {
        const out = new Float32Array(channels * done);
        for (let c = 0; c < channels; c++) {
          for (let i = 0; i < done; i++) out[c * done + i] = sum[c * chunkSamples + i]! / Math.max(weights[i]!, 1e-12);
          // Shift what is still open to the front of the window.
          sum.copyWithin(c * chunkSamples, c * chunkSamples + done, (c + 1) * chunkSamples);
          sum.fill(0, (c + 1) * chunkSamples - done, (c + 1) * chunkSamples);
        }
        region.stems.push(out);
      }
      weights.copyWithin(0, done);
      weights.fill(0, chunkSamples - done);
      base = to;
      return region;
    },
  };
};
