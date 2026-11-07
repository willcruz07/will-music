import { describe, expect, it } from 'vitest';
import { chordProToSheet, isChordLine, sheetToChordPro } from '../src/lib/chordSheet.ts';

describe('chord sheet format', () => {
  it('writes chords on the line above the lyrics, at the syllable where they fall', () => {
    expect(chordProToSheet('[G]Ninguém ex[D]plica [Em]Deus')).toBe('G         D     Em\nNinguém explica Deus');
  });

  it('keeps directives, empty lines and chord-only lines', () => {
    expect(chordProToSheet('{title: Hino}\n\n[C] [G]')).toBe('{title: Hino}\n\n[C] [G]');
  });

  it('pads the lyric when a chord sits past its end', () => {
    expect(chordProToSheet('Deus[A]')).toBe('    A\nDeus');
  });

  it('recognises chord lines', () => {
    expect(isChordLine('G  D/F#  Em7  C7M')).toBe(true);
    expect(isChordLine('Ninguém explica Deus')).toBe(false);
    expect(isChordLine('A casa')).toBe(false);
    expect(isChordLine('')).toBe(false);
  });

  it('turns a sheet back into ChordPro, chord by chord', () => {
    expect(sheetToChordPro('G       D       Em\nNinguém explica Deus')).toBe('[G]Ninguém [D]explica [Em]Deus');
  });

  it('keeps a chord line with no lyric under it as a chord-only line', () => {
    expect(sheetToChordPro('{comment: Intro}\nC  G  Am\n\n')).toBe('{comment: Intro}\n[C] [G] [Am]\n\n');
  });

  it('round-trips a chart', () => {
    const chart = '{title: Hino}\n{comment: Refrão}\n[G]Ninguém ex[D]plica [Em]Deus\n\n[C]Santo';
    expect(sheetToChordPro(chordProToSheet(chart))).toBe(chart);
  });
});
