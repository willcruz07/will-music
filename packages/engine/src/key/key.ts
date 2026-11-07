// keyMap order from Musetric packages/ai/src/key/keyMap.ts (MIT, commit
// f37b6b1b054e08db0ec4411479b8092524d6dac2), matching the S-KEY model output.
export type KeyMode = 'major' | 'minor';

export const keyMap: readonly { root: string; mode: KeyMode }[] = [
  ...['A', 'Bb', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'].map((root) => ({ root, mode: 'major' as const })),
  ...['B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb'].map((root) => ({ root, mode: 'minor' as const })),
];

export type KeyResult = { root: string; mode: KeyMode; label: string; index: number; margin: number };

export const decodeKey = (probs: Float32Array): KeyResult => {
  if (probs.length !== keyMap.length) throw new RangeError(`S-KEY must return ${keyMap.length} probabilities`);
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i]! > probs[best]!) best = i;
  let second = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < probs.length; i++) if (i !== best) second = Math.max(second, probs[i]!);
  const { root, mode } = keyMap[best]!;
  return { root, mode, label: `${root} ${mode}`, index: best, margin: probs[best]! - second };
};

const NOTE_PC: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const MINOR_QUALITIES = new Set(['min', 'min6', 'min7', 'minmaj7', 'dim', 'dim7', 'hdim7']);

/**
 * Fallback key estimate from detected chords (used when S-KEY cannot run): each key scores the time
 * covered by its diatonic chords, plus a bonus for its tonic chord. margin is always 0.
 */
export const estimateKeyFromChords = (segments: readonly { start: number; end: number; raw: string }[]): KeyResult => {
  const chords = segments
    .filter((s) => s.raw !== 'N' && s.raw !== 'X')
    .map((s) => {
      const [root = '', quality = 'maj'] = s.raw.split(':');
      return { pc: NOTE_PC[root] ?? -1, minor: MINOR_QUALITIES.has(quality), dur: s.end - s.start };
    })
    .filter((c) => c.pc >= 0);
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  keyMap.forEach((key, index) => {
    const tonic = NOTE_PC[key.root]!;
    const majors = key.mode === 'major' ? [0, 5, 7] : [3, 7, 8, 10];
    const minors = key.mode === 'major' ? [2, 4, 9] : [0, 5, 7];
    let score = 0;
    for (const c of chords) {
      const degree = (c.pc - tonic + 12) % 12;
      if ((c.minor ? minors : majors).includes(degree)) score += c.dur;
      if (degree === 0 && c.minor === (key.mode === 'minor')) score += 0.5 * c.dur;
    }
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  const { root, mode } = keyMap[best]!;
  return { root, mode, label: `${root} ${mode}`, index: best, margin: 0 };
};
