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
