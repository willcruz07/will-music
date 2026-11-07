import { BASIC_PITCH, type Posteriors } from './basicPitch.ts';

export type NoteEvent = { pitch: number; start: number; end: number; velocity: number };

export type NoteOptions = { onsetThreshold?: number; frameThreshold?: number; minFrames?: number; energyTolerance?: number };

const FRAME_SEC = BASIC_PITCH.HOP_SAMPLES / BASIC_PITCH.SAMPLE_RATE;

/**
 * Simplified port of Basic Pitch's output_to_notes_polyphonic: every onset peak starts a note that
 * lasts while the note probability stays above the frame threshold (with a small gap tolerance).
 * Peaks are taken latest first and their energy is consumed, as in the original.
 */
export const extractNotes = (p: Posteriors, opts: NoteOptions = {}): NoteEvent[] => {
  const { onsetThreshold = 0.5, frameThreshold = 0.3, minFrames = 11, energyTolerance = 11 } = opts;
  const { BINS, MIDI_OFFSET } = BASIC_PITCH;
  const { frames, onset } = p;
  const energy = p.note.slice();
  const peaks: { f: number; b: number }[] = [];
  for (let f = 1; f < frames - 1; f++) {
    for (let b = 0; b < BINS; b++) {
      const v = onset[f * BINS + b]!;
      if (v >= onsetThreshold && v > onset[(f - 1) * BINS + b]! && v >= onset[(f + 1) * BINS + b]!) peaks.push({ f, b });
    }
  }
  peaks.sort((a, z) => z.f - a.f);
  const notes: NoteEvent[] = [];
  for (const { f, b } of peaks) {
    let i = f + 1;
    let gap = 0;
    while (i < frames - 1 && gap < energyTolerance) {
      gap = energy[i * BINS + b]! < frameThreshold ? gap + 1 : 0;
      i++;
    }
    i -= gap;
    if (i - f < minFrames) continue;
    let sum = 0;
    for (let k = f; k < i; k++) {
      sum += p.note[k * BINS + b]!;
      energy[k * BINS + b] = 0;
      if (b > 0) energy[k * BINS + b - 1] = 0;
      if (b < BINS - 1) energy[k * BINS + b + 1] = 0;
    }
    notes.push({ pitch: b + MIDI_OFFSET, start: f * FRAME_SEC, end: i * FRAME_SEC, velocity: sum / (i - f) });
  }
  return notes.sort((a, z) => a.start - z.start || a.pitch - z.pitch);
};

/** Reduces notes to a single melodic line inside a singable range. */
export const toMelody = (notes: readonly NoteEvent[], range: { minPitch?: number; maxPitch?: number } = {}): NoteEvent[] => {
  const { minPitch = 45, maxPitch = 84 } = range;
  const weight = (n: NoteEvent) => n.velocity * (n.end - n.start);
  const sorted = notes.filter((n) => n.pitch >= minPitch && n.pitch <= maxPitch).sort((a, z) => a.start - z.start);
  const out: NoteEvent[] = [];
  for (const note of sorted) {
    const prev = out.at(-1);
    if (!prev || note.start >= prev.end) {
      out.push({ ...note });
      continue;
    }
    // Overlap: a much weaker note is an accompaniment ghost; otherwise the newer note takes over.
    if (weight(note) < 0.5 * weight(prev)) continue;
    if (note.start - prev.start < 0.05) {
      if (weight(note) > weight(prev)) out[out.length - 1] = { ...note };
      continue;
    }
    prev.end = note.start;
    out.push({ ...note });
  }
  return out;
};
