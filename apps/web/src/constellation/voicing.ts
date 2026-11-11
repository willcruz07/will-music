import { chordNotes } from '../lib/chordNotation.ts';
import type { SynthEvent } from '../lib/synth.ts';

/** Small bounded search: rotations in two registers, all chord tones retained, no model or sample. */
export const voiceChord = (chord: string, previous: readonly number[] = []): number[] => {
  const pcs = chordNotes(chord.split('/')[0]!) ?? [];
  if (!pcs.length) return [];
  const sorted = [...new Set(pcs)].sort((a, b) => a - b);
  let best: number[] = [];
  let bestScore = Infinity;
  for (const register of [48, 60]) for (let rotation = 0; rotation < sorted.length; rotation++) {
    const order = [...sorted.slice(rotation), ...sorted.slice(0, rotation)];
    const notes: number[] = [];
    for (const pc of order) {
      let note = register + pc;
      while (notes.length && note <= notes.at(-1)!) note += 12;
      notes.push(note);
    }
    const middle = notes.reduce((sum, note) => sum + note, 0) / notes.length;
    const movement = previous.length
      ? notes.reduce((sum, note) => sum + Math.min(...previous.map(old => Math.abs(note - old))), 0)
        + previous.reduce((sum, old) => sum + Math.min(...notes.map(note => Math.abs(note - old))), 0)
      : 0;
    const score = movement + Math.abs(middle - 64) * 0.15;
    if (score < bestScore) { best = notes; bestScore = score; }
  }
  return best;
};

export const constellationEvents = (chords: readonly string[], bpm = 80, beats = 2): SynthEvent[] => {
  const duration = 60 / bpm * beats;
  let previous: number[] = [];
  return chords.flatMap((chord, index) => {
    const pcs = chordNotes(chord);
    if (!pcs?.length) return [];
    previous = voiceChord(chord, previous);
    return [{ time: index * duration, dur: duration * 0.9, pitch: 36 + pcs[0]! },
      ...previous.map(pitch => ({ time: index * duration, dur: duration * 0.9, pitch }))];
  });
};
