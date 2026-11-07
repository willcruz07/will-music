import { describe, expect, it } from 'vitest';
import { chordNotes, isKnownChord } from '../src/lib/chordNotation.ts';
import { setChordAt } from '../src/lib/chordProEdit.ts';

describe('chord insertion', () => {
  it('inserts, replaces and removes a chord', () => {
    expect(setChordAt('Ninguém explica', 0, 8, 'D')).toBe('Ninguém [D]explica');
    expect(setChordAt('Ninguém [D]explica', 0, 8, 'Em')).toBe('Ninguém [Em]explica');
    expect(setChordAt('[G]Ninguém [D]explica', 0, 8, null)).toBe('[G]Ninguém explica');
  });

  it('targets the k-th lyric line, skipping directives and chord rows', () => {
    const cho = '{title: T}\n{comment: Intro}\n[G] [D]\num\ndois';
    expect(setChordAt(cho, 1, 0, 'A')).toBe('{title: T}\n{comment: Intro}\n[G] [D]\num\n[A]dois');
  });
});

describe('chord notation', () => {
  it.each(['C7M', 'F#m7(b5)', 'D/F#', 'G4', 'C°', 'Bb9', 'Cº', 'E7(9)', 'Am6', 'Dsus4', 'A5', 'C+'])('knows %s', (c) => {
    expect(isKnownChord(c)).toBe(true);
  });
  it.each(['Xyz', 'H7', '', 'Cq'])('rejects %s', (c) => expect(isKnownChord(c)).toBe(false));

  it.each([
    ['Cm7', [0, 3, 7, 10]],
    ['D/F#', [6, 2, 9]],
    ['G7M(9)', [7, 11, 2, 6, 9]],
    ['F#m7(b5)', [6, 9, 0, 4]],
    ['A4', [9, 2, 4]],
    ['Bb9', [10, 2, 5, 0]],
    ['E7(9)', [4, 8, 11, 2, 6]],
  ])('notes of %s', (c, notes) => expect(chordNotes(c)).toEqual(notes));
});
