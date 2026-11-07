import type { NoteEvent } from './notes.ts';

/** Sixteenth notes per 4/4 bar. */
export const TICKS_PER_BAR = 16;

/** A note on the sixteenth-note grid. */
export type QNote = { pitch: number; start: number; dur: number };
export type Harmony = { tick: number; raw: string };

/** Tick 0 sits at `origin` seconds (≤ 0) and every tick lasts `tick` seconds. */
export type Grid = { bpm: number; origin: number; tick: number };

const nearness = (t: number, step: number, phase: number) => {
  const d = Math.abs((((t - phase) % step) + step) % step);
  return 1 - Math.min(d, step - d) / (step / 2); // 1 on the grid, 0 half-way
};

/**
 * Places the grid: the beat phase that best fits note onsets (sixteenths) and chord changes (beats),
 * then the bar line on the beat where most chord changes land.
 */
export const buildGrid = (bpm: number, onsets: readonly number[], chordStarts: readonly number[]): Grid => {
  const beat = 60 / bpm;
  const tick = beat / 4;
  let phase = 0;
  let best = -1;
  for (let k = 0; k < 16; k++) {
    const p = (k / 16) * beat;
    let score = 0;
    for (const t of onsets) score += nearness(t, tick, p);
    for (const t of chordStarts) score += 2 * nearness(t, beat, p);
    if (score > best + 1e-9) {
      best = score;
      phase = p;
    }
  }
  let shift = 0;
  let bestBar = -1;
  for (let b = 0; b < 4; b++) {
    let hits = 0;
    for (const t of chordStarts) if (nearness(t, 4 * beat, phase + b * beat) > 0.75) hits++;
    if (hits > bestBar) {
      bestBar = hits;
      shift = b;
    }
  }
  let origin = phase + shift * beat;
  while (origin > 1e-9) origin -= 4 * beat;
  return { bpm, origin, tick };
};

export const tickAt = (grid: Grid, seconds: number): number => Math.max(0, Math.round((seconds - grid.origin) / grid.tick));

/** Snaps notes to the grid; overlapping notes are cut so the line stays monophonic. */
export const quantize = (notes: readonly NoteEvent[], grid: Grid): QNote[] => {
  const out: QNote[] = [];
  for (const n of [...notes].sort((a, z) => a.start - z.start)) {
    const start = tickAt(grid, n.start);
    const dur = Math.max(1, tickAt(grid, n.end) - start);
    const prev = out.at(-1);
    if (prev && start <= prev.start) continue;
    if (prev && prev.start + prev.dur > start) prev.dur = start - prev.start;
    out.push({ pitch: n.pitch, start, dur });
  }
  return out;
};

/** Chord segments to chord symbols on the grid (no-chord and unknown segments are skipped). */
export const chordsToHarmony = (segments: readonly { start: number; raw: string }[], grid: Grid): Harmony[] => {
  const out: Harmony[] = [];
  for (const s of segments) {
    if (s.raw === 'N' || s.raw === 'X') continue;
    const tick = tickAt(grid, s.start);
    const prev = out.at(-1);
    if (prev && prev.tick === tick) out[out.length - 1] = { tick, raw: s.raw };
    else if (!prev || prev.raw !== s.raw) out.push({ tick, raw: s.raw });
  }
  return out;
};
