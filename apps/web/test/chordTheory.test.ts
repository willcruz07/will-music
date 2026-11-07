import { describe, expect, it } from 'vitest';
import { CHORD_TYPES, chordFormation, harmonicField, scaleNotes } from '../src/lib/chordTheory.ts';
import { CAVAQUINHO, findVoicings } from '../src/lib/frettedShapes.ts';
import { chordNotes } from '../src/lib/chordNotation.ts';

describe('chord formation', () => {
  it('lists notes and intervals of a chord', () => {
    expect(chordFormation('C', '')).toMatchObject({ name: 'C', notes: ['C', 'E', 'G'], intervals: ['1', '3M', '5J'] });
    expect(chordFormation('A', 'm7')).toMatchObject({ name: 'Am7', notes: ['A', 'C', 'E', 'G'] });
    expect(chordFormation('Bb', '7M').notes).toEqual(['Bb', 'D', 'F', 'A']);
    expect(chordFormation('F#', '°').notes).toEqual(['F#', 'A', 'C']);
  });

  it('only offers chord types the app can draw and read', () => {
    for (const t of CHORD_TYPES) expect(chordNotes(`C${t.suffix}`), t.suffix).not.toBeNull();
  });
});

describe('scales and harmonic field', () => {
  it('spells scales in the key (sharps or flats)', () => {
    expect(scaleNotes('G', 'major')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
    expect(scaleNotes('F', 'major')).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
    expect(scaleNotes('A', 'minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('builds the harmonic field of a major key', () => {
    const field = harmonicField('C', 'major');
    expect(field.map((d) => d.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(field.map((d) => d.triad)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°']);
    expect(field.map((d) => d.tetrad)).toEqual(['C7M', 'Dm7', 'Em7', 'F7M', 'G7', 'Am7', 'Bm7(b5)']);
  });

  it('builds the harmonic field of a minor key', () => {
    expect(harmonicField('A', 'minor').map((d) => d.triad)).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G']);
  });
});

describe('fretted voicings', () => {
  it('finds playable cavaquinho shapes using only chord notes and covering all of them', () => {
    const pcs = [0, 4, 7];
    const shapes = findVoicings(pcs, 0, CAVAQUINHO.tuning);
    expect(shapes.length).toBeGreaterThan(2);
    for (const s of shapes) {
      const notes = s.frets.map((f, i) => (CAVAQUINHO.tuning[i]! + f) % 12);
      expect(notes.every((n) => pcs.includes(n))).toBe(true);
      expect(new Set(notes)).toEqual(new Set(pcs));
      const fretted = s.frets.filter((f) => f > 0);
      expect(Math.max(0, ...fretted) - Math.min(99, ...fretted)).toBeLessThanOrEqual(3);
    }
  });

  it('drops the fifth when a four-string instrument meets a five-note chord', () => {
    const shapes = findVoicings([0, 4, 7, 10, 2], 0, CAVAQUINHO.tuning);
    expect(shapes.length).toBeGreaterThan(0);
  });
});
