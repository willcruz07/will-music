import { describe, expect, it } from 'vitest';
import { type Chord, type Move, chordKey, chordName, isAltered, levelOf, neighbors, parseChord, startCenter } from '../src/constellation/harmony.ts';
import { chordNotes } from '../src/lib/chordNotation.ts';

const C = { root: 0, minor: false };
const at = (moves: Move[]) => Object.fromEntries(moves.map((m) => [chordName(m.to, m.nextCenter), m]));
const pcs = (name: string) => new Set(chordNotes(name)!);

describe('harmony v2: relax, tension, resolution', () => {
  it('from G7 there is only resolution or more tension, never its own substitutes', () => {
    const m = at(neighbors({ root: 7, quality: '7' }, C));
    expect(m['C7M']!.motion).toBe('resolve');
    for (const n of ['Am7', 'Em7', 'Ab7M']) expect(m[n]!.motion).toBe('resolve');
    expect(m['C7']!.motion).toBe('tensiona');
    expect(m['F#7']!.motion).toBe('tensiona');
    for (const n of ['Bm7(b5)', 'Db7', 'Dm7']) expect(m[n]).toBeUndefined();
  });

  it('no dominant ever offers a chord with its own tritone as the next step', () => {
    for (let r = 0; r < 12; r++) {
      const tritone = [(r + 4) % 12, (r + 10) % 12];
      for (const move of neighbors({ root: r, quality: '7' }, startCenter({ root: r, quality: '7' }))) {
        if (move.motion !== 'tensiona') continue;
        const notes = pcs(chordName(move.to, move.nextCenter));
        expect(tritone.every((p) => notes.has(p)), chordName(move.to, move.nextCenter)).toBe(false);
      }
    }
  });

  it('resolution only appears when the current chord is a tension', () => {
    for (const n of ['C7M', 'Dm7', 'F7M', 'Am7', 'G']) {
      const c = parseChord(n)!;
      expect(neighbors(c, startCenter(c)).some((m) => m.motion === 'resolve'), n).toBe(false);
    }
  });

  it('dark colors of the dominant ask for the minor resolution first', () => {
    const dark = neighbors({ root: 7, quality: '7(b9)' }, C).filter((x) => x.motion === 'resolve');
    expect(chordName(dark[0]!.to, dark[0]!.nextCenter)).toBe('Cm7');
    const clear = neighbors({ root: 7, quality: '7(13)' }, C).filter((x) => x.motion === 'resolve');
    expect(chordName(clear[0]!.to, clear[0]!.nextCenter)).toBe('C7M');
  });

  it('substitutes appear where the tension is approached', () => {
    for (const from of [{ root: 0, quality: '7M' as const }, { root: 2, quality: 'm7' as const }]) {
      const m = at(neighbors(from, C));
      for (const n of ['G7', 'Bm7(b5)', 'Db7']) expect(m[n]!.motion, n).toBe('tensiona');
    }
  });

  it('a pure major triad has an open intention', () => {
    const G = parseChord('G')!;
    const m = at(neighbors(G, startCenter(G)));
    expect(m['D7M']!.motion).toBe('relaxa');
    expect(m['C']!.motion).toBe('relaxa');
    expect(m['G7']!.motion).toBe('tensiona');
  });

  it('A7 → Dm7 resolves and moves the center to Dm (the ii of C); Dm7 still prepares G7', () => {
    const toDm = at(neighbors({ root: 9, quality: '7' }, C))['Dm7']!;
    expect(toDm.motion).toBe('resolve');
    expect(toDm.nextCenter).toEqual({ root: 2, minor: true });
    expect(toDm.why).toContain('Dm (o ii de C)');
    expect(at(neighbors(toDm.to, toDm.nextCenter))['G7']!.motion).toBe('tensiona');
  });

  it('C7M → Am7 relaxes; E7(b9) → Am7 in A minor is a full resolution', () => {
    expect(at(neighbors({ root: 0, quality: '7M' }, C))['Am7']!.motion).toBe('relaxa');
    const Am = { root: 9, minor: true };
    const full = at(neighbors({ root: 4, quality: '7(b9)' }, Am))['Am7']!;
    expect(full.motion).toBe('resolve');
    expect(full.nextCenter).toEqual(Am);
  });

  it('walks the pattern relaxa, relaxa, relaxa, tensiona, resolve', () => {
    const motions: string[] = [];
    let cur: Chord = { root: 0, quality: '7M' };
    let center = C;
    for (const n of ['Am7', 'Em7', 'F7M', 'G7', 'C7M']) {
      const m = at(neighbors(cur, center))[n];
      expect(m, `${n} from ${chordName(cur, center)}`).toBeDefined();
      motions.push(m!.motion);
      cur = m!.to;
      center = m!.nextCenter;
    }
    expect(motions).toEqual(['relaxa', 'relaxa', 'relaxa', 'tensiona', 'resolve']);
  });

  it('walks the pattern tensiona, tensiona, resolve, tensiona, resolve (ii–V chain)', () => {
    const motions: string[] = [];
    let cur: Chord = { root: 0, quality: '7M' };
    let center = C;
    for (const n of ['E7', 'A7', 'Dm7', 'G7', 'C7M']) {
      const m = at(neighbors(cur, center))[n];
      expect(m, `${n} from ${chordName(cur, center)}`).toBeDefined();
      motions.push(m!.motion);
      cur = m!.to;
      center = m!.nextCenter;
    }
    expect(motions).toEqual(['tensiona', 'tensiona', 'resolve', 'tensiona', 'resolve']);
  });

  it('the balloon offers the types of the root, each with its own intention', () => {
    const g = at(neighbors({ root: 0, quality: '7M' }, C))['G7']!;
    const o = Object.fromEntries(g.options.map((x) => [chordName(x.to, x.nextCenter), x]));
    expect(Object.keys(o)).toEqual(expect.arrayContaining(['G', 'G7M', 'G7', 'G7(9)', 'G7(13)', 'G7(b9)', 'G7(#5)', 'G7sus4']));
    expect(o['G']!.motion).toBe('relaxa');
    expect(o['G7(b9)']!.motion).toBe('tensiona');
    expect(o['G7M']!.nextCenter).toEqual({ root: 7, minor: false });
    for (const x of g.options) expect(x.why.length).toBeGreaterThan(10);
  });

  it('G7 and G7(b9) are the same star', () => {
    expect(chordKey({ root: 7, quality: '7' })).toBe(chordKey({ root: 7, quality: '7(b9)' }));
    expect(chordKey({ root: 7, quality: '7' })).not.toBe(chordKey({ root: 7, quality: '7M' }));
  });

  it('every move explains itself and the orbit stays within 6 to 16 chords', () => {
    for (const n of ['C7M', 'Dm7', 'G7', 'G', 'F7M', 'Am7', 'Bm7(b5)', 'C#°7', 'E7(b9)']) {
      const c = parseChord(n)!;
      const moves = neighbors(c, startCenter(c));
      // A tension only resolves or passes the tension on: a focused orbit (at least 5); stable chords open at least 6.
      expect(moves.length, n).toBeGreaterThanOrEqual(levelOf(c, startCenter(c)) === 'tensao' ? 5 : 6);
      expect(moves.length, n).toBeLessThanOrEqual(16);
      for (const m of moves) expect(m.why.length).toBeGreaterThan(10);
    }
  });

  it('knows the level of a chord in its center', () => {
    expect(levelOf({ root: 0, quality: '7M' }, C)).toBe('repouso');
    expect(levelOf({ root: 9, quality: 'm7' }, C)).toBe('repouso');
    expect(levelOf({ root: 2, quality: 'm7' }, C)).toBe('afastamento');
    expect(levelOf({ root: 5, quality: '7M' }, C)).toBe('afastamento');
    expect(levelOf({ root: 7, quality: '7' }, C)).toBe('tensao');
    expect(levelOf({ root: 11, quality: 'm7(b5)' }, C)).toBe('tensao');
  });
});

describe('harmony v2: spelling and starting chords', () => {
  it('spells flat contexts with flats: Ab7, Db7 → Gb, C#°7 → Eb7(b9)', () => {
    const ab = parseChord('Ab7')!;
    const ab7 = neighbors(ab, startCenter(ab));
    expect(ab7.map((m) => chordName(m.to, m.nextCenter)).some((n) => n.includes('#'))).toBe(false);
    expect(ab7.map((m) => m.why).join(' ')).not.toMatch(/#/);
    const db7 = at(neighbors(parseChord('Db7')!, C))['Gb7M']!;
    expect(db7.motion).toBe('resolve');
    expect(db7.why).toMatch(/Gb7M/);
    const dim = parseChord('C#°7')!;
    expect(neighbors(dim, startCenter(dim)).map((m) => chordName(m.to, m.nextCenter))).toContain('Eb7(b9)');
  });

  it('the ii chain names the key the ii belongs to', () => {
    const gm7 = at(neighbors({ root: 2, quality: 'm7' }, C))['Gm7']!;
    expect(gm7.why).toMatch(/ii de F\b/);
  });

  it('starts from tricky chords with a coherent center', () => {
    expect(startCenter(parseChord('Bm7(b5)')!)).toEqual({ root: 9, minor: true });
    expect(startCenter(parseChord('C#°7')!)).toEqual({ root: 2, minor: false });
    expect(startCenter(parseChord('G7')!)).toEqual({ root: 0, minor: false });
    expect(startCenter(parseChord('Dm7')!)).toEqual({ root: 2, minor: true });
    expect(startCenter(parseChord('G')!)).toEqual({ root: 7, minor: false });
  });

  it('parses and names round-trip', () => {
    for (const n of ['C7M', 'Dm7', 'G7', 'Bm7(b5)', 'C#°7', 'Fm6', 'Bb7M', 'Am', 'G7(b9)', 'G7(13)', 'C6(9)', 'Dm7(9)', 'G7sus4']) {
      expect(chordName(parseChord(n)!, startCenter(parseChord(n)!))).toBe(n);
    }
  });
});

describe('harmony v2: from the relatives', () => {
  it('a relative minor can go to the V7 of the center (vi → V)', () => {
    expect(at(neighbors({ root: 9, quality: 'm7' }, C))['G7']!.motion).toBe('tensiona');
    expect(at(neighbors({ root: 4, quality: 'm7' }, C))['G7']!.motion).toBe('tensiona');
  });
});

describe('review 2 fixes: harmony', () => {
  const step = (from: Chord, center: { root: number; minor: boolean }, name: string) => at(neighbors(from, center))[name]!;

  it('a substitute dominant resolves where its own text says it goes', () => {
    for (const [from, sub] of [['C7M', 'Db7'], ['C7M', 'Bb7'], ['Dm7', 'Db7']] as const) {
      const s = step(parseChord(from)!, C, sub);
      expect(s, `${from} → ${sub}`).toBeDefined();
      const next = at(neighbors(s.to, s.nextCenter, s.resolvesTo));
      expect(next['C7M']?.motion, `${from} → ${sub} → C7M`).toBe('resolve');
    }
  });

  it('deceptive cadences follow a minor resolution (no major-key relatives)', () => {
    const Am = { root: 9, minor: true };
    const names = neighbors({ root: 4, quality: '7(b9)' }, Am).map((m) => chordName(m.to, m.nextCenter));
    expect(names).not.toContain('F#m7');
    expect(names).not.toContain('C#m7');
    expect(names).toContain('F7M');
  });

  it('the iv goes home by the plagal cadence and borrowed chords keep the center', () => {
    const fm6 = parseChord('Fm6')!;
    const m = at(neighbors(fm6, C));
    expect(m['C7M']!.motion).toBe('relaxa');
    expect(m['C7M']!.why).toMatch(/plagal/);
    if (m['Ab7M']) {
      expect(m['Ab7M']!.nextCenter).toEqual(C);
      expect(m['Ab7M']!.why).not.toMatch(/mesmas notas/);
    }
  });

  it('balloon options of a tension continuation never claim to resolve', () => {
    const f7 = at(neighbors({ root: 7, quality: '7' }, C))['F#7']!;
    expect(f7.options.some((o) => o.motion === 'resolve')).toBe(false);
  });

  it('offers the V7 of the V and names the minor targets of secondary dominants', () => {
    const m = at(neighbors({ root: 0, quality: '7M' }, C));
    expect(m['D7']!.motion).toBe('tensiona');
    expect(m['A7']!.why).toMatch(/\bDm\b/);
    expect(m['E7']!.why).toMatch(/\bAm\b/);
  });

  it('never states that F7M shares three notes with Bm7(b5)', () => {
    const bm = parseChord('Bm7(b5)')!;
    for (const m of neighbors(bm, startCenter(bm))) expect(m.why).not.toMatch(/três notas/);
  });
});

describe('altered chords', () => {
  it('knows which tensions carry altered notes', () => {
    expect(isAltered({ root: 7, quality: '7(b9)' })).toBe(true);
    expect(isAltered({ root: 7, quality: '7(#5)' })).toBe(true);
    expect(isAltered({ root: 1, quality: '°7' })).toBe(true);
    for (const q of ['7', '7(9)', '7(13)', '7sus4', 'm7(b5)', '7M'] as const) expect(isAltered({ root: 7, quality: q }), q).toBe(false);
  });
});

describe('a plain dominant offers both resolutions', () => {
  it('E7 in C resolves to Am7 (local) and also to A7M, which moves the center to A', () => {
    const m = at(neighbors({ root: 4, quality: '7' }, C));
    expect(m['Am7']!.motion).toBe('resolve');
    expect(m['A7M']!.motion).toBe('resolve');
    expect(m['A7M']!.nextCenter).toEqual({ root: 9, minor: false });
    expect(m['A7M']!.options.map((o) => o.to.quality)).toEqual(expect.arrayContaining(['', '7M', '6']));
    const resolves = neighbors({ root: 4, quality: '7' }, C).filter((x) => x.motion === 'resolve');
    expect(chordName(resolves[0]!.to, resolves[0]!.nextCenter)).toBe('Am7');
  });

  it('G7 in C resolves to C7M first and also to Cm7', () => {
    const resolves = neighbors({ root: 7, quality: '7' }, C).filter((x) => x.motion === 'resolve').map((x) => chordName(x.to, x.nextCenter));
    expect(resolves[0]).toBe('C7M');
    expect(resolves).toContain('Cm7');
  });
});

describe('every tension: resolve, chromatic approach above and below, or turn into its own minor', () => {
  it('G7 offers Ab7 and F#7 (chromatic approach) and Gm7 (relaxes into the ii of F)', () => {
    const m = at(neighbors({ root: 7, quality: '7' }, C));
    expect(m['Ab7']!.motion).toBe('tensiona');
    expect(m['Ab7']!.why).toMatch(/sobe meio tom/);
    expect(m['F#7']!.why).toMatch(/desce meio tom/);
    expect(m['Gm7']!.motion).toBe('relaxa');
    expect(m['Gm7']!.why).toMatch(/ii de um novo ii–V, que leva a F/);
    // From Gm7 the new ii–V continues: C7, which resolves in F.
    const fromGm = at(neighbors(m['Gm7']!.to, m['Gm7']!.nextCenter));
    expect(fromGm['C7']!.motion).toBe('tensiona');
  });

  it('walks C7M → C#°7 → Dm7 → G7(13) → F#7(13) → F#m7 → B7 → E7M', () => {
    const path = ['C#°7', 'Dm7', 'G7', 'F#7', 'F#m7', 'B7', 'E7M'];
    let chord: Chord = { root: 0, quality: '7M' };
    let center = C;
    const walked: string[] = [];
    for (const name of path) {
      const moves = neighbors(chord, center);
      const move = moves.flatMap((mv) => mv.options.length ? mv.options : [mv]).find((mv) => chordName(mv.to, mv.nextCenter) === name);
      expect(move, `${walked.join(' → ')} → ${name}`).toBeDefined();
      walked.push(name);
      chord = move!.to;
      center = move!.nextCenter;
    }
    // The 13th colors are in the balloons of G7 and F#7.
    const g7 = neighbors({ root: 2, quality: 'm7' }, C).find((mv) => chordKey(mv.to) === '7:dom')!;
    expect(g7.options.map((o) => chordName(o.to, o.nextCenter))).toContain('G7(13)');
  });
});
