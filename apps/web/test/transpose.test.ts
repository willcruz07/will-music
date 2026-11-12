import { describe, expect, it } from 'vitest';
import { prefersFlats, transposeChord, transposeKey } from '../src/lib/transpose.ts';

describe('transposition', () => {
  it.each([
    ['Bb', 2, false, 'C'], ['C#m7', -1, false, 'Cm7'], ['D/F#', 1, false, 'D#/G'], ['D/F#', 1, true, 'Eb/G'],
    ['G7M(9)', 5, false, 'C7M(9)'], ['A#m7(b5)', 0, false, 'A#m7(b5)'], ['B', 1, false, 'C'], ['C', -1, true, 'B'],
    ['N.C.', 3, false, 'N.C.'], ['c#m7', 1, false, 'Dm7'],
    ['C6/9', 2, false, 'D6/9'], ['G7/9', 2, false, 'A7/9'], ['C7/9/E', 2, false, 'D7/9/F#'],
    ['B♭m7/E♭', 2, false, 'Cm7/F'], ['C♯m7/G♯', -1, false, 'Cm7/G'],
    ['E#7', 1, false, 'F#7'], ['Cb7', 1, false, 'C7'], ['C G/B', 2, false, 'D A/C#'],
    ['C7(9, 13)', 2, false, 'D7(9, 13)'],
  ] as const)('transposes %s by %i', (chord, n, flats, out) => {
    expect(transposeChord(chord, n, flats)).toBe(out);
  });

  it('knows which keys use flats', () => {
    expect(prefersFlats('F')).toBe(true);
    expect(prefersFlats('Gm')).toBe(true);
    expect(prefersFlats('G')).toBe(false);
    expect(prefersFlats('F#m')).toBe(false);
  });

  it('spells keys by destination', () => {
    expect(transposeKey('G', 3)).toBe('Bb');
    expect(transposeKey('Em', 2)).toBe('F#m');
    expect(transposeKey('A', 0)).toBe('A');
    expect(transposeKey('C', 5)).toBe('F');
  });
});
