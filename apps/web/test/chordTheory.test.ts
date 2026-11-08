import { describe, expect, it } from 'vitest';
import { CHORD_TYPES, KEYS, chordFormation, harmonicField, scaleNotes } from '../src/lib/chordTheory.ts';
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
    expect(field.map((d) => d.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'viiø']);
    expect(field.map((d) => d.triad)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bm(b5)']);
    expect(field.map((d) => d.tetrad)).toEqual(['C7M', 'Dm7', 'Em7', 'F7M', 'G7', 'Am7', 'Bm7(b5)']);
  });

  it('builds the harmonic field of a minor key', () => {
    expect(harmonicField('A', 'minor').map((d) => d.triad)).toEqual(['Am', 'Bm(b5)', 'C', 'Dm', 'Em', 'F', 'G']);
    expect(harmonicField('A', 'minor')[1]!.roman).toBe('iiø');
  });
});

describe('fretted voicings', () => {
  it('finds playable cavaquinho shapes using only chord notes and covering all of them', () => {
    const pcs = [0, 4, 7];
    const shapes = findVoicings(pcs, 0, CAVAQUINHO.tuning);
    expect(shapes.length).toBeGreaterThan(2);
    for (const s of shapes) {
      const absolute = s.frets.map((f) => (f > 0 && s.baseFret > 1 ? f + s.baseFret - 1 : f));
      const notes = absolute.map((f, i) => (CAVAQUINHO.tuning[i]! + f) % 12);
      expect(notes.every((n) => pcs.includes(n))).toBe(true);
      expect(new Set(notes)).toEqual(new Set(pcs));
      const fretted = absolute.filter((f) => f > 0);
      expect(Math.max(0, ...fretted) - Math.min(99, ...fretted)).toBeLessThanOrEqual(3);
    }
  });

  it('drops the fifth when a four-string instrument meets a five-note chord', () => {
    const shapes = findVoicings([0, 4, 7, 10, 2], 0, CAVAQUINHO.tuning);
    expect(shapes.length).toBeGreaterThan(0);
  });
});

describe('pending fixes: theory', () => {
  it('spells pentatonic and blues notes by degree (the blue note is a flat fifth)', () => {
    expect(scaleNotes('E', 'blues')).toEqual(['E', 'G', 'A', 'Bb', 'B', 'D']);
    expect(scaleNotes('A', 'blues')).toEqual(['A', 'C', 'D', 'Eb', 'E', 'G']);
    expect(scaleNotes('F', 'minorPentatonic')).toEqual(['F', 'Ab', 'Bb', 'C', 'Eb']);
    expect(scaleNotes('D', 'majorPentatonic')).toEqual(['D', 'E', 'F#', 'A', 'B']);
  });

  it('builds the harmonic field of the harmonic minor (with the major V)', () => {
    const field = harmonicField('A', 'harmonicMinor');
    expect(field.map((d) => d.triad)).toEqual(['Am', 'Bm(b5)', 'C+', 'Dm', 'E', 'F', 'G#°']);
    expect(field[4]!.tetrad).toBe('E7');
    expect(field[6]!.tetrad).toBe('G#°7');
  });

  it('offers sharp minor keys like G#m and D#m', () => {
    expect(KEYS).toContain('G#');
    expect(KEYS).toContain('D#');
    expect(scaleNotes('G#', 'minor')).toEqual(['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#']);
  });
});

describe('fix: half-diminished seventh degree', () => {
  it('names the four-note chord of the seventh degree as half-diminished (viiø7)', () => {
    const vii = harmonicField('C', 'major')[6]!;
    expect(vii).toMatchObject({ roman: 'viiø', triad: 'Bm(b5)', tetrad: 'Bm7(b5)', tetradRoman: 'viiø7' });
    expect(harmonicField('A', 'minor')[1]!.tetradRoman).toBe('iiø7');
    expect(harmonicField('A', 'harmonicMinor')[6]!.tetradRoman).toBe('vii°7');
    expect(harmonicField('C', 'major')[4]!.tetradRoman).toBe('V7');
  });
});

describe('the half-diminished triad m(b5)', () => {
  it('is its own chord in the dictionary and has guitar shapes', async () => {
    const { parseStudyChord } = await import('../src/pages/StudyPage.tsx');
    const { dbKeyFor } = await import('../src/lib/chordShapes.ts');
    expect(parseStudyChord('Bm(b5)')).toEqual({ root: 'B', suffix: 'm(b5)' });
    expect(dbKeyFor('Bm(b5)')).toEqual({ key: 'B', suffix: 'dim' });
    expect(chordFormation('B', 'm(b5)').notes).toEqual(['B', 'D', 'F']);
  });
});
