import type { LogCqt } from '../cqt/cpuCqt.ts';
import { toDisplayLabel } from './labels.ts';
import { chordLabelAt } from './vocab.ts';

export type ChordSegment = { start: number; end: number; raw: string; label: string };

export const windowFeatures = (cqt: LogCqt, seqLen = 108, windowsPerRun = 16): Float32Array[] => {
  const windowCount = Math.ceil(cqt.frameCount / seqLen);
  const runCount = Math.ceil(windowCount / windowsPerRun);
  const runFloats = windowsPerRun * seqLen * cqt.binCount;
  const runs: Float32Array[] = [];
  for (let r = 0; r < runCount; r++) {
    const run = new Float32Array(runFloats);
    const start = r * runFloats;
    const end = Math.min(cqt.data.length, start + runFloats);
    if (end > start) run.set(cqt.data.subarray(start, end));
    runs.push(run);
  }
  return runs;
};

export const smoothArgmax = (
  logits: Float32Array,
  frameCount: number,
  seqLen = 108,
  chordCount = 170,
  radius = 4,
): Int32Array => {
  const indices = new Int32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    const windowStart = frame - (frame % seqLen);
    const local = frame % seqLen;
    let best = 0;
    let bestValue = Number.NEGATIVE_INFINITY;
    for (let chord = 0; chord < chordCount; chord++) {
      let total = 0;
      for (let offset = -radius; offset <= radius; offset++) {
        const neighbor = local + offset;
        if (neighbor < 0 || neighbor >= seqLen) continue;
        total += logits[(windowStart + neighbor) * chordCount + chord] ?? 0;
      }
      if (total > bestValue) {
        bestValue = total;
        best = chord;
      }
    }
    indices[frame] = best;
  }
  return indices;
};

/**
 * Keep short, stable changes without trusting every frame-level fluctuation. The short-window decision
 * must agree with the unsmoothed model for at least three consecutive frames (~0.28 s at ChordMini's
 * hop). Elsewhere retain the original wider smoothing. Runs never borrow evidence across model windows.
 */
export const adaptiveChordIndices = (
  logits: Float32Array,
  frameCount: number,
  seqLen = 108,
  chordCount = 170,
  stableRadius = 4,
): Int32Array => {
  const stable = smoothArgmax(logits, frameCount, seqLen, chordCount, stableRadius);
  const sensitive = smoothArgmax(logits, frameCount, seqLen, chordCount, 1);
  const raw = smoothArgmax(logits, frameCount, seqLen, chordCount, 0);
  const minimumFrames = 3;

  for (let windowStart = 0; windowStart < frameCount; windowStart += seqLen) {
    const windowEnd = Math.min(frameCount, windowStart + seqLen);
    let start = windowStart;
    while (start < windowEnd) {
      const chord = sensitive[start]!;
      let end = start + 1;
      while (end < windowEnd && sensitive[end] === chord) end++;
      let consecutive = 0;
      let supported = false;
      for (let frame = start; frame < end; frame++) {
        consecutive = raw[frame] === chord ? consecutive + 1 : 0;
        if (consecutive >= minimumFrames) {
          supported = true;
          break;
        }
      }
      if (supported) stable.fill(chord, start, end);
      start = end;
    }
  }
  return stable;
};

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export const buildChordSegments = (indices: Int32Array, frameDuration: number): ChordSegment[] => {
  const segments: ChordSegment[] = [];
  if (indices.length === 0) return segments;
  const push = (startFrame: number, endFrame: number, index: number) => {
    const raw = chordLabelAt(index);
    segments.push({ start: round3(startFrame * frameDuration), end: round3(endFrame * frameDuration), raw, label: toDisplayLabel(raw) });
  };
  let previous = indices[0]!;
  let startFrame = 0;
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== previous) {
      push(startFrame, i, previous);
      startFrame = i;
      previous = indices[i]!;
    }
  }
  push(startFrame, indices.length, previous);
  return segments;
};
