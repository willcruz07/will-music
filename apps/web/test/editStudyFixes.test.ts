import { describe, expect, it } from 'vitest';
import { inversion, keyboardVoicing } from '../src/components/ChordDiagram.tsx';
import { chordNoteNames } from '../src/components/ChordHelp.tsx';
import { chordProToSheet, insertChordInSheet, isLossless, sheetToChordPro, snapOutOfBrackets } from '../src/lib/chordSheet.ts';
import { chordFormation, pcOf, scaleNotes } from '../src/lib/chordTheory.ts';
import { CAVAQUINHO, findVoicings } from '../src/lib/frettedShapes.ts';
import { parseStudyChord } from '../src/pages/StudyPage.tsx';

const roundTrip = (c: string) => sheetToChordPro(chordProToSheet(c));

describe('review fixes: lossless chord-above layout', () => {
  it.each([
    '[C(add9)]Letra [G]mais',
    '[Bb7(11+)]Letra',
    '[N.C.] [G]',
    'Letra [x2]',
    '[Refrão]',
    '[G7M]Eu [D]vou',
    '[G][D]Letra',
    '{comment: Intro}\n[G] [D]\nLetra sem acorde',
    'A casa\n[G]Santo',
    '\tTab\t[G]aqui',
  ])('keeps %j exactly', (chart) => {
    expect(roundTrip(chart)).toBe(chart);
    expect(isLossless(chart)).toBe(true);
  });

  it('flags a chart that only ChordPro can hold (a lyric line that is just a chord name)', () => {
    expect(isLossless('E\n[G]Santo')).toBe(false);
  });

  it('still shows ordinary lines with the chords above', () => {
    expect(chordProToSheet('[G]Ninguém ex[D]plica')).toBe('G         D\nNinguém explica');
  });
});

describe('review fixes: inserting chords', () => {
  it('writes the chord in the chord line above, at the column of the cursor', () => {
    const sheet = 'G\nNinguém explica';
    const caret = sheet.indexOf('explica');
    const r = insertChordInSheet(sheet, caret, 'D');
    expect(r.text).toBe('G       D\nNinguém explica');
    expect(sheetToChordPro(r.text)).toBe('[G]Ninguém [D]explica');
  });

  it('creates the chord line when the lyric has none', () => {
    const r = insertChordInSheet('Santo santo', 6, 'C');
    expect(r.text).toBe('      C\nSanto santo');
  });

  it('never puts a chord inside another in ChordPro', () => {
    const text = '[G]Santo';
    expect(snapOutOfBrackets(text, 1)).toBe(3);
    expect(snapOutOfBrackets(text, 5)).toBe(5);
  });
});

describe('review fixes: spelling and theory', () => {
  it('spells chord notes by letter', () => {
    expect(chordNoteNames('Gm')).toEqual(['G', 'Bb', 'D']);
    expect(chordNoteNames('Cm7')).toEqual(['C', 'Eb', 'G', 'Bb']);
    expect(chordNoteNames('C7')).toEqual(['C', 'E', 'G', 'Bb']);
    expect(chordFormation('F#', '7M').notes).toEqual(['F#', 'A#', 'C#', 'E#']);
    expect(chordFormation('E', '°').notes).toEqual(['E', 'G', 'Bb']);
    expect(chordFormation('C', '°7')).toMatchObject({ notes: ['C', 'Eb', 'Gb', 'Bbb'], intervals: ['1', '3m', '5b', '7°'] });
    expect(chordFormation('F', '+').notes).toEqual(['F', 'A', 'C#']);
    expect(chordFormation('Ab', 'm').notes).toEqual(['Ab', 'Cb', 'Eb']);
  });

  it('reads every accidental', () => {
    expect([pcOf('E#'), pcOf('B#'), pcOf('Cb'), pcOf('Fb'), pcOf('Bbb')]).toEqual([5, 0, 11, 4, 9]);
    expect(scaleNotes('F#', 'major')).toContain('E#');
  });

  it('understands the chords the song page links to', () => {
    expect(parseStudyChord('G/B')).toEqual({ root: 'G', suffix: '' });
    expect(parseStudyChord('Dm7b5')).toEqual({ root: 'D', suffix: 'm7(b5)' });
    expect(parseStudyChord('Cdim')).toEqual({ root: 'C', suffix: '°' });
    expect(parseStudyChord('A7+')).toEqual({ root: 'A', suffix: '7M' });
    expect(parseStudyChord('D7(b9)')).toEqual({ root: 'D', suffix: '7' });
    expect(parseStudyChord('E#°')).toEqual({ root: 'F', suffix: '°' });
    expect(parseStudyChord('Ebm(add11)')).toEqual({ root: 'Eb', suffix: 'm' });
  });
});

describe('review fixes: diagrams', () => {
  it('draws cavaquinho shapes high on the neck relative to their first fret', () => {
    for (const s of findVoicings([0, 4, 7], 0, CAVAQUINHO.tuning, { max: 20 })) {
      for (const f of s.frets) expect(f).toBeLessThanOrEqual(s.baseFret > 1 ? 4 : 5);
    }
  });

  it('keeps every note in keyboard inversions, and the bass of slash chords', () => {
    const c79 = [0, 4, 7, 10, 2];
    for (let v = 0; v < 4; v++) expect(new Set(keyboardVoicing(inversion(c79, v)).map((n) => n % 12))).toEqual(new Set(c79));
    expect(keyboardVoicing(inversion([4, 0, 7], 1, true))[0]! % 12).toBe(4);
  });
});
