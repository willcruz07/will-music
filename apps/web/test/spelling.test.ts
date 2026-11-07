import { describe, expect, it } from 'vitest';
import { transposeChord, transposeKey } from '../src/lib/transpose.ts';

describe('spelling by key', () => {
  it.each([
    ['A#', 'C', 'Bb'], ['D#', 'C', 'Eb'], ['G#', 'C', 'Ab'], ['F#', 'C', 'F#'], ['C#m', 'A', 'C#m'],
    ['A#', 'G', 'Bb'], ['A#7', 'F', 'Bb7'], ['F#', 'D', 'F#'], ['D#°', 'E', 'D#°'], ['G#/C', 'C', 'Ab/C'],
  ])('spells %s in %s as %s', (chord, key, out) => {
    expect(transposeChord(chord, 0, key)).toBe(out);
  });

  it('spells after transposing using the destination key', () => {
    expect(transposeChord('A#', 2, 'D')).toBe('C');
    expect(transposeChord('C', 1, 'C#')).toBe('C#');
  });

  it('uses the usual Brazilian key names', () => {
    expect(transposeKey('E', 2)).toBe('F#');
    expect(transposeKey('C#m', 2)).toBe('D#m');
    expect(transposeKey('A', 1)).toBe('Bb');
    expect(transposeKey('C', 1)).toBe('C#');
    expect(transposeKey('Am', 1)).toBe('Bbm');
    expect(transposeKey('G', 1)).toBe('Ab');
  });
});
