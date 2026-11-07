import { describe, expect, it } from 'vitest';
import { dbKeyFor, guitarShape, toSvguitar } from '../src/lib/chordShapes.ts';

describe('guitar chord shapes', () => {
  it.each([
    ['C', { key: 'C', suffix: 'major' }],
    ['C#m7', { key: 'Csharp', suffix: 'm7' }],
    ['Bb7M', { key: 'Bb', suffix: 'maj7' }],
    ['F#m7(b5)', { key: 'Fsharp', suffix: 'm7b5' }],
    ['A#°', { key: 'Bb', suffix: 'dim' }],
    ['G4', { key: 'G', suffix: 'sus4' }],
    ['E9', { key: 'E', suffix: 'add9' }],
    ['E7(9)', { key: 'E', suffix: '9' }],
    ['D/F#', { key: 'D', suffix: '/F#' }],
    ['Am/G', { key: 'A', suffix: 'm/G' }],
  ])('maps %s', (chord, expected) => expect(dbKeyFor(chord)).toEqual(expected));

  it('finds shapes for common chords and none for unknown ones', async () => {
    expect((await guitarShape('C'))!.frets).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(await guitarShape('C#m7')).not.toBeNull();
    expect(await guitarShape('D/F#')).not.toBeNull();
    expect(await guitarShape('Xyz')).toBeNull();
  });

  it('falls back to the chord without bass when the slash shape is missing', async () => {
    expect(await guitarShape('C7/Bb')).toEqual(await guitarShape('C7'));
  });

  it('converts to svguitar strings (1 = high E)', () => {
    const drawn = toSvguitar({ frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], baseFret: 1, barres: [] });
    expect(drawn.fingers).toEqual([[6, 'x'], [5, 3, '3'], [4, 2, '2'], [3, 0], [2, 1, '1'], [1, 0]]);
    expect(drawn.position).toBe(1);
    const barre = toSvguitar({ frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], baseFret: 1, barres: [1] });
    expect(barre.barres).toEqual([{ fromString: 6, toString: 1, fret: 1 }]);
  });
});
