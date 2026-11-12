import { midiName, noteOf } from '@will-music/engine';

export type TuningPreset = { id: string; label: string; strings: number[]; minHz: number };

/** Strings listed from the thickest to the thinnest, as MIDI notes. */
export const TUNINGS: TuningPreset[] = [
  { id: 'chromatic', label: 'Cromático (qualquer nota)', strings: [], minHz: 50 },
  { id: 'guitar', label: 'Violão / guitarra (Mi Lá Ré Sol Si Mi)', strings: [40, 45, 50, 55, 59, 64], minHz: 60 },
  { id: 'bass', label: 'Baixo 4 cordas (Mi Lá Ré Sol)', strings: [28, 33, 38, 43], minHz: 30 },
  { id: 'cavaco', label: 'Cavaquinho (Ré Sol Si Ré)', strings: [62, 67, 71, 74], minHz: 200 },
  { id: 'ukulele', label: 'Ukulele (Sol Dó Mi Lá)', strings: [67, 60, 64, 69], minHz: 200 },
];

export type TunerReading = { note: string; solfege: string; octave: number; cents: number; target?: { string: number; name: string }; inTune: boolean };

/**
 * What the tuner shows for a frequency: with an instrument, the nearest string and how far from it
 * (so a guitar string tuned a semitone low still points at the right string); otherwise the nearest note.
 */
export const tunerReading = (hz: number, preset: TuningPreset, a4 = 440, selectedString?: number): TunerReading => {
  const exact = 69 + 12 * Math.log2(hz / a4);
  if (preset.strings.length) {
    const selected = selectedString === undefined ? -1 : preset.strings.length - selectedString;
    let best = selected >= 0 && selected < preset.strings.length ? selected : 0;
    if (selected < 0 || selected >= preset.strings.length) preset.strings.forEach((m, i) => {
      if (Math.abs(exact - m) < Math.abs(exact - preset.strings[best]!)) best = i;
    });
    const midi = preset.strings[best]!;
    const near = noteOf(a4 * 2 ** ((midi - 69) / 12), a4);
    const cents = Math.round((exact - midi) * 100);
    return { note: near.name, solfege: near.solfege, octave: near.octave, cents, target: { string: preset.strings.length - best, name: midiName(midi) }, inTune: Math.abs(cents) <= 5 };
  }
  const n = noteOf(hz, a4);
  return { note: n.name, solfege: n.solfege, octave: n.octave, cents: n.cents, inTune: Math.abs(n.cents) <= 5 };
};

/** Median of the last readings: steadies the needle without lagging much. */
export const median = (values: readonly number[]): number => {
  const s = [...values].sort((a, z) => a - z);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * Halves the sample rate (average of each pair) into `out`: pitch detection then costs about a quarter,
 * which matters on modest phones, and 22–24 kHz is far more than any tuned note needs.
 */
export const decimate2 = (input: Float32Array, out: Float32Array): Float32Array => {
  for (let i = 0; i < out.length; i++) out[i] = (input[2 * i]! + input[2 * i + 1]!) * 0.5;
  return out;
};
