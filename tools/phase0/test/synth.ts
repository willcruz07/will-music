import { type ChordSegment, type MajMin, toMajMin } from '@will-music/engine';

const RATE = 22050;

const addNote = (out: Float32Array, freq: number, from: number, to: number) => {
  for (let k = 1; k <= 5; k++) {
    const f = freq * k;
    if (f >= RATE / 2) break;
    for (let i = from; i < to; i++) out[i]! += Math.sin((2 * Math.PI * f * i) / RATE) / k;
  }
};

const normalize = (out: Float32Array): Float32Array => {
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i]! *= 0.5 / peak;
  return out;
};

export const chordTone = (freqs: number[], seconds: number): Float32Array => {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (const f of freqs) addNote(out, f, 0, out.length);
  return normalize(out);
};

export const progression = (chords: number[][], secondsEach: number, repeats: number): Float32Array => {
  const step = Math.round(secondsEach * RATE);
  const out = new Float32Array(step * chords.length * repeats);
  for (let r = 0; r < repeats; r++) {
    chords.forEach((freqs, c) => {
      const from = (r * chords.length + c) * step;
      for (const f of freqs) addNote(out, f, from, from + step);
    });
  }
  return normalize(out);
};

export const shareOfTime = (segments: ChordSegment[], target: MajMin): number => {
  let total = 0;
  let hit = 0;
  for (const s of segments) {
    const d = s.end - s.start;
    total += d;
    const c = toMajMin(s.raw);
    if (c && c.pc === target.pc && c.quality === target.quality) hit += d;
  }
  return total > 0 ? hit / total : 0;
};
