import { describe, expect, it } from 'vitest';
import { type Chord, type Move, chordName, neighbors, parseChord, startCenter } from '../src/constellation/harmony.ts';
import { chordNotes } from '../src/lib/chordNotation.ts';

const C = { root: 0, minor: false };
const names = (moves: Move[]) => moves.map((m) => chordName(m.to, C));

describe('harmony engine: major center', () => {
  it('from C (center C) offers the core paths, each with its kind', () => {
    const moves = neighbors({ root: 0, quality: '7M' }, C);
    const byName = Object.fromEntries(moves.map((m) => [chordName(m.to, C), m]));
    expect(byName['G7']!.kind).toBe('cadencia');
    expect(byName['Bm7(b5)']!.kind).toBe('tritono');
    expect(byName['Db7']!.kind).toBe('subV');
    expect(byName['Dm7']!.kind).toBe('iiV');
    expect(byName['Am7']!.kind).toBe('relativo');
    expect(byName['A7']!.kind).toBe('secundario');
    expect(byName['Fm6']!.kind).toBe('emprestimo');
    expect(byName['C7']!.kind).toBe('viraDominante');
    expect(moves.length).toBeGreaterThanOrEqual(6);
    expect(moves.length).toBeLessThanOrEqual(12);
  });

  it('every move explains itself and carries a family', () => {
    for (const m of neighbors({ root: 0, quality: '7M' }, C)) {
      expect(m.why.length).toBeGreaterThan(10);
      expect(['tonica', 'subdominante', 'dominante', 'alterado']).toContain(m.family);
    }
  });

  it('Bm7(b5) and G7 share the tritone B–F (the reason for the substitution)', () => {
    const pcs = (c: Chord) => new Set(chordNotes(chordName(c, C))!);
    const g7 = pcs({ root: 7, quality: '7' });
    const bm7b5 = pcs({ root: 11, quality: 'm7(b5)' });
    expect(g7.has(11) && g7.has(5) && bm7b5.has(11) && bm7b5.has(5)).toBe(true);
  });

  it('groups the colors of a dominant into one neighbor', () => {
    const g7 = neighbors({ root: 0, quality: '7M' }, C).find((m) => chordName(m.to, C) === 'G7')!;
    expect(g7.variants).toEqual(['G7(9)', 'G7(13)', 'G7(b9)', 'G7(#5)']);
    expect(names(neighbors({ root: 0, quality: '7M' }, C)).filter((n) => n.startsWith('G7')).length).toBe(1);
  });

  it('from Dm7 the ii–V chain continues: G7, and Gm7 as the ii of F', () => {
    const moves = neighbors({ root: 2, quality: 'm7' }, C);
    expect(names(moves)).toContain('G7');
    expect(moves.find((m) => chordName(m.to, C) === 'Gm7')!.kind).toBe('cadeia');
  });

  it('spells with flats in flat centers', () => {
    const F = { root: 5, minor: false };
    const all = neighbors({ root: 5, quality: '7M' }, F).map((m) => chordName(m.to, F));
    expect(all).toContain('Bbm6');
    expect(all).toContain('Gb7');
    expect(all.some((n) => n.includes('#'))).toBe(false);
  });

  it('never offers the current chord as its own neighbor', () => {
    for (const n of ['C7M', 'Dm7', 'G7']) {
      const c = parseChord(n)!;
      expect(neighbors(c, C).some((m) => m.to.root === c.root && m.to.quality === c.quality)).toBe(false);
    }
  });

  it('parses and names round-trip', () => {
    for (const n of ['C7M', 'Dm7', 'G7', 'Bm7(b5)', 'C#°7', 'Fm6', 'Bb7M', 'Am']) expect(chordName(parseChord(n)!, startCenter(parseChord(n)!))).toBe(n);
  });
});

describe('harmony engine: explanations', () => {
  it('the deceptive cadence names the chord it avoids', () => {
    const engano = neighbors({ root: 7, quality: '7' }, C).find((m) => chordName(m.to, C) === 'Am7')!;
    expect(engano.why).toMatch(/em vez de C\b/);
  });
});

describe('harmony engine: centers', () => {
  it('resolving V→I moves the center (tonicization)', () => {
    const toF = neighbors({ root: 0, quality: '7' }, C).find((m) => m.kind === 'cadencia')!;
    expect(chordName(toF.to, C)).toBe('F7M');
    expect(toF.nextCenter).toEqual({ root: 5, minor: false });
    expect(toF.why).toMatch(/centro tonal/);
  });

  it('resolving to the current tonic keeps the center', () => {
    const toC = neighbors({ root: 7, quality: '7' }, C).find((m) => m.kind === 'cadencia')!;
    expect(chordName(toC.to, C)).toBe('C7M');
    expect(toC.nextCenter).toEqual(C);
  });

  it('a minor center brings the minor relations', () => {
    const Am = { root: 9, minor: true };
    const all = neighbors({ root: 9, quality: 'm7' }, Am).map((m) => chordName(m.to, Am));
    expect(all).toEqual(expect.arrayContaining(['Bm7(b5)', 'E7', 'F7M', 'G7']));
  });

  it('starts from tricky chords with a coherent center and a valid orbit', () => {
    expect(startCenter(parseChord('Bm7(b5)')!)).toEqual({ root: 9, minor: true });
    expect(startCenter(parseChord('C#°7')!)).toEqual({ root: 2, minor: false });
    expect(startCenter(parseChord('G7')!)).toEqual({ root: 0, minor: false });
    expect(startCenter(parseChord('Dm7')!)).toEqual({ root: 2, minor: true });
    for (const n of ['Bm7(b5)', 'C#°7', 'G7', 'Dm7', 'F7M']) {
      const c = parseChord(n)!;
      expect(neighbors(c, startCenter(c)).length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('review fixes: harmony', () => {
  const names = (c: Chord, center = startCenter(c)) => neighbors(c, center).map((m) => ({ name: chordName(m.to, m.nextCenter), why: m.why }));

  it('spells flat contexts with flats: Ab7, Db7 → Gb, C#°7 → Eb7', () => {
    const ab7 = names(parseChord('Ab7')!);
    expect(ab7.map((n) => n.name).some((n) => n.includes('#'))).toBe(false);
    expect(ab7.map((n) => n.why).join(' ')).not.toMatch(/#/);
    const db7 = neighbors(parseChord('Db7')!, { root: 0, minor: false }).find((m) => m.kind === 'cadencia')!;
    expect(chordName(db7.to, db7.nextCenter)).toBe('Gb7M');
    expect(db7.why).toMatch(/Gb7M/);
    expect(names(parseChord('C#°7')!).map((n) => n.name)).toContain('Eb7');
  });

  it('the ii chain names the key the ii belongs to', () => {
    const gm7 = neighbors({ root: 2, quality: 'm7' }, { root: 0, minor: false }).find((m) => m.kind === 'cadeia')!;
    expect(gm7.why).toMatch(/ii de F\b/);
  });

  it('after a secondary dominant onto a minor chord, the ii–V is still there (I–VI7–ii–V)', () => {
    const C = { root: 0, minor: false };
    const toA7 = neighbors({ root: 0, quality: '7M' }, C).find((m) => chordName(m.to, C) === 'A7')!;
    const toDm7 = neighbors(toA7.to, toA7.nextCenter).find((m) => m.kind === 'cadencia')!;
    expect(chordName(toDm7.to, toDm7.nextCenter)).toBe('Dm7');
    expect(neighbors(toDm7.to, toDm7.nextCenter).map((m) => chordName(m.to, m.nextCenter))).toContain('G7');
  });

  it('offers the borrowed chords from the minor key, with the right explanation', () => {
    const C = { root: 0, minor: false };
    const moves = neighbors({ root: 0, quality: '7M' }, C);
    const bb7 = moves.find((m) => chordName(m.to, C) === 'Bb7')!;
    expect(bb7.kind).toBe('emprestimo');
    expect(bb7.why).not.toMatch(/mixolídio/);
    expect(moves.map((m) => chordName(m.to, C))).toContain('Ab7M');
  });
});
