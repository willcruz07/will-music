// Same order as Musetric packages/ai/src/chords/chordVocab.ts (MIT, commit
// f37b6b1b054e08db0ec4411479b8092524d6dac2) and the model's config.json chordVocab.
export const CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const CHORD_QUALITIES = [
  'min', 'maj', 'dim', 'aug', 'min6', 'maj6', 'min7', 'minmaj7', 'maj7', '7', 'dim7', 'hdim7', 'sus2', 'sus4',
] as const;

export const NO_CHORD = 'N';
export const UNKNOWN_CHORD = 'X';

export const chordVocab: readonly string[] = [
  ...CHORD_ROOTS.flatMap((root) => CHORD_QUALITIES.map((q) => (q === 'maj' ? root : `${root}:${q}`))),
  UNKNOWN_CHORD,
  NO_CHORD,
];

export const chordLabelAt = (index: number): string => chordVocab[index] ?? NO_CHORD;
