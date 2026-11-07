import { describe, expect, it } from 'vitest';
import { chordNotes } from '../src/lib/chordNotation.ts';
import { SCALE_LIBRARY, fretboardBox, parseTab, rhythmEvents, romanToChord, spellScale } from '../src/study/theory.ts';

describe('roman numerals to chords', () => {
  it('turns degrees into chords of the key', () => {
    expect(['ii7', 'V7', 'I7M'].map((r) => romanToChord(r, 'C'))).toEqual(['Dm7', 'G7', 'C7M']);
    expect(['I', 'V', 'vi', 'IV'].map((r) => romanToChord(r, 'G'))).toEqual(['G', 'D', 'Em', 'C']);
    expect(romanToChord('viiø', 'C')).toBe('Bm7(b5)');
    expect(romanToChord('vii°7', 'C')).toBe('B°7');
    expect(romanToChord('bVII', 'C')).toBe('Bb');
    expect(romanToChord('bVI7M', 'C')).toBe('Ab7M');
    expect(romanToChord('iv', 'C')).toBe('Fm');
  });

  it('handles secondary dominants and tritone substitutes', () => {
    expect(romanToChord('V7/ii', 'C')).toBe('A7');
    expect(romanToChord('V7/V', 'C')).toBe('D7');
    expect(romanToChord('subV7', 'C')).toBe('Db7');
    expect(romanToChord('subV7/ii', 'C')).toBe('Eb7');
  });

  it('works in minor keys (degrees from the natural minor)', () => {
    expect(['iiø', 'V7', 'i'].map((r) => romanToChord(r, 'A', 'minor'))).toEqual(['Bm7(b5)', 'E7', 'Am']);
    expect(romanToChord('VI7M', 'A', 'minor')).toBe('F7M');
  });

  it('always produces chords the app can draw', () => {
    for (const r of ['I', 'ii7', 'iii7', 'IV7M', 'V7(9)', 'vi7', 'viiø', 'V7/vi', 'subV7', 'bVII7', 'iv6', 'I6(9)', 'V7sus4', 'bII7M']) {
      expect(chordNotes(romanToChord(r, 'Eb')), r).not.toBeNull();
    }
  });
});

describe('scale library', () => {
  it('spells modes and world scales by degree', () => {
    expect(spellScale('D', 'dorian')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
    expect(spellScale('E', 'phrygianDominant')).toEqual(['E', 'F', 'G#', 'A', 'B', 'C', 'D']);
    expect(spellScale('E', 'hirajoshi')).toEqual(['E', 'F#', 'G', 'B', 'C']);
    expect(spellScale('C', 'bhairav')).toEqual(['C', 'Db', 'E', 'F', 'G', 'Ab', 'B']);
    expect(spellScale('C', 'wholeTone')).toEqual(['C', 'D', 'E', 'F#', 'G#', 'A#']);
    expect(spellScale('C', 'diminishedHW')).toEqual(['C', 'Db', 'Eb', 'E', 'F#', 'G', 'A', 'Bb']);
  });

  it('describes every scale with steps inside an octave', () => {
    for (const s of Object.values(SCALE_LIBRARY)) {
      expect(s.steps[0]).toBe(0);
      expect(s.steps.every((x, i, a) => i === 0 || x > a[i - 1]!)).toBe(true);
      expect(Math.max(...s.steps)).toBeLessThan(12);
      expect(s.degrees.length).toBe(s.steps.length);
    }
  });
});

describe('scale on the neck', () => {
  it('lays a scale in a five-fret box with each string ascending', () => {
    const box = fretboardBox(9, SCALE_LIBRARY.minorPentatonic.steps, [40, 45, 50, 55, 59, 64], 5);
    // A minor pentatonic, 5th position: two notes per string.
    expect(box.map((s) => s.frets)).toEqual([[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]]);
    expect(box[0]!.roots).toEqual([5]);
  });
});

describe('rhythm patterns', () => {
  it('turns step patterns into drum hits at the tempo', () => {
    const hits = rhythmEvents({ bpm: 120, steps: 8, tracks: [{ sound: 'kick', pattern: 'x...x...' }, { sound: 'hihat', pattern: 'x.x.x.x.' }] });
    expect(hits.filter((h) => h.drum === 'kick').map((h) => h.time)).toEqual([0, 0.5]);
    expect(hits.filter((h) => h.drum === 'hihat')).toHaveLength(4);
  });
});

describe('tablature', () => {
  it('reads an ASCII tab into notes in order', () => {
    const notes = parseTab(['e|-----5-8-|', 'B|---5-----|', 'G|-7-------|', 'D|---------|', 'A|---------|', 'E|---------|'].join('\n'));
    expect(notes.map((n) => [n.string, n.fret])).toEqual([
      [3, 7],
      [2, 5],
      [1, 5],
      [1, 8],
    ]);
    expect(notes[0]!.midi).toBe(55 + 7);
  });

  it('reads two-digit frets', () => {
    expect(parseTab('e|-12-15-|\nB|-------|\nG|-------|\nD|-------|\nA|-------|\nE|-------|').map((n) => n.fret)).toEqual([12, 15]);
  });
});

describe('box as tab', () => {
  it('writes a box as tab that reads back to the same notes, low to high', async () => {
    const { boxTab } = await import('../src/study/theory.ts');
    const box = fretboardBox(9, SCALE_LIBRARY.minorPentatonic.steps, [40, 45, 50, 55, 59, 64], 5);
    const notes = parseTab(boxTab(box));
    expect(notes.map((n) => n.fret)).toEqual([5, 8, 5, 7, 5, 7, 5, 7, 5, 8, 5, 8]);
    expect(notes.map((n) => n.string)).toEqual([6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
  });
});
