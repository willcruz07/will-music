import { beforeEach, describe, expect, it } from 'vitest';
import { mergeAdvancedChords, applyAdvancedChords } from '../src/lib/applyAdvancedChords.ts';
import { createSong, db } from '../src/lib/db.ts';
import { chordNotes } from '../src/lib/chordNotation.ts';
import { CAVAQUINHO, findVoicings } from '../src/lib/frettedShapes.ts';

beforeEach(async () => { await db.songs.clear(); await db.analyses.clear(); await db.charts.clear(); await db.audio.clear(); });

describe('applying advanced chords', () => {
  it('preserves both sides of a chord crossing the replacement interval', () => {
    const original = [{ raw: 'C', label: 'C', start: 0, end: 20 }];
    const advanced = [{ raw: 'G:7', label: 'G7', start: 5, end: 10.001 }];
    expect(mergeAdvancedChords(original, advanced, 5, 10)).toEqual([
      { raw: 'C', label: 'C', start: 0, end: 5 }, { raw: 'G:7', label: 'G7', start: 5, end: 10 }, { raw: 'C', label: 'C', start: 10, end: 20 },
    ]);
    expect(original[0]!.end).toBe(20);
  });

  it('does not replace existing chords with an empty analysis', () => {
    expect(() => mergeAdvancedChords([], [{ raw: 'N', label: 'N.C.', start: 0, end: 5 }], 0, 5)).toThrow();
  });

  it.each(['edited', 'generated'] as const)('protects %s chart according to its origin', async (origin) => {
    const song = await createSong({ title: 'Teste', artist: '', durationSec: 20 }, new Blob());
    const key = { root: 'C', mode: 'major' as const, label: 'C major', index: 3, margin: 1 };
    await db.analyses.add({ id: 'a', songId: song.id, schemaVersion: 1, models: {}, key, chords: [{ raw: 'C', label: 'C', start: 0, end: 20 }], createdAt: '', updatedAt: '' });
    await db.charts.add({ id: 'c', songId: song.id, chordPro: '[C]Minha edição', transpose: 2, fontSize: 20, origin, createdAt: '', updatedAt: '' });
    const result = await applyAdvancedChords(song.id, [{ raw: 'F:maj/2', label: 'F/G', start: 5, end: 10 }], 5, 10);
    const chart = await db.charts.get('c');
    expect(chart?.transpose).toBe(2);
    expect((await db.analyses.get('a'))?.chords.map((segment) => segment.label)).toEqual(['C', 'F/G', 'C']);
    expect(result).toBe(origin === 'edited' ? 'kept-edited' : 'rebuilt');
    if (origin === 'edited') expect(chart?.chordPro).toBe('[C]Minha edição');
    else expect(chart?.chordPro).toContain('[F/G]');
  });
});

describe('advanced diagrams', () => {
  it.each([
    ['C7(13)', [0, 4, 7, 10, 9]], ['Cm7(b5)', [0, 3, 6, 10]],
    ['C7(9,11)', [0, 4, 7, 10, 2, 5]], ['F/G', [7, 5, 9, 0]],
  ])('uses the actual notes of %s', (chord, notes) => expect(chordNotes(chord)).toEqual(notes));

  it('does not silently truncate a six-note chord to four strings', () => {
    expect(findVoicings([0, 4, 7, 10, 2, 5], 0, CAVAQUINHO.tuning, { strictNotes: true })).toEqual([]);
  });
  it('honors the requested bass in strict mode', () => {
    const tuning = [40, 45, 50, 55, 59, 64];
    const shapes = findVoicings([4, 0, 7], 0, tuning, { strictBass: true, strictNotes: true });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const pitches = shape.frets.map((fret, string) => tuning[string]! + (fret > 0 ? fret + shape.baseFret - 1 : 0));
      expect(Math.min(...pitches) % 12).toBe(4);
    }
  });
});
