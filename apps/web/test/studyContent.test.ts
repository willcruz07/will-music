import { describe, expect, it } from 'vitest';
import { chordNotes } from '../src/lib/chordNotation.ts';
import { LESSONS, TRACKS, lessonById, trackLessons } from '../src/study/catalog.ts';
import { KEYS } from '../src/lib/chordTheory.ts';
import { SCALE_LIBRARY, type ScaleId, fretboardBox, firstBoxFret, parseTab, romanToChord } from '../src/study/theory.ts';
import { PROGRESSION_CATALOG } from '../src/study/tools.tsx';
import { LEVELS } from '../src/study/types.ts';

describe('study content integrity', () => {
  it('has unique lesson ids, known tracks and levels', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tracks = new Set(TRACKS.map((t) => t.id));
    const levels = new Set(LEVELS.map((l) => l.id));
    for (const l of LESSONS) {
      expect(tracks.has(l.track), l.id).toBe(true);
      expect(levels.has(l.level), l.id).toBe(true);
      expect(l.blocks.length, l.id).toBeGreaterThan(0);
    }
  });

  it('gives every track lessons, ordered by level', () => {
    for (const t of TRACKS) {
      const ls = trackLessons(t.id);
      expect(ls.length, t.id).toBeGreaterThan(0);
      const order = ls.map((l) => LEVELS.findIndex((x) => x.id === l.level));
      expect(order, t.id).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it('only uses chords, degrees, scales, rhythms and tabs the app can play', () => {
    for (const l of [...LESSONS, { id: 'catalogo', blocks: PROGRESSION_CATALOG }]) {
      for (const b of l.blocks) {
        const where = `${l.id}/${b.kind}`;
        if (b.kind === 'chords') for (const c of b.chords) expect(chordNotes(c), `${where} ${c}`).not.toBeNull();
        if (b.kind === 'progression')
          for (const d of b.degrees) {
            const chord = romanToChord(d, b.key ?? 'C', b.mode);
            expect(chordNotes(chord), `${where} ${d} → ${chord}`).not.toBeNull();
          }
        if (b.kind === 'scale') expect(SCALE_LIBRARY[b.scale], `${where} ${b.scale}`).toBeDefined();
        if (b.kind === 'rhythm')
          for (const tr of b.pattern.tracks) expect(tr.pattern.length, `${where} ${tr.sound}`).toBe(b.pattern.steps);
        if (b.kind === 'tab') expect(parseTab(b.tab).length, where).toBeGreaterThan(0);
        if (b.kind === 'intervals') for (const s of b.semitones) expect(s >= 0 && s <= 12, `${where} ${s}`).toBe(true);
      }
    }
  });
});

describe('review fixes: study content', () => {
  it('plays every progression in every key with plain (no double-accidental) roots', () => {
    for (const l of [...LESSONS, { id: 'catalogo', blocks: PROGRESSION_CATALOG }])
      for (const b of l.blocks) {
        if (b.kind !== 'progression') continue;
        for (const key of KEYS)
          for (const d of b.degrees) {
            const chord = romanToChord(d, key, b.mode);
            expect(chord, `${l.id} ${d} in ${key}`).not.toMatch(/^[A-G](bb|##)/u);
            expect(chordNotes(chord), `${l.id} ${d} in ${key} → ${chord}`).not.toBeNull();
          }
      }
  });

  it('plays the position box as an ascending run that skips no scale note', () => {
    const tuning = [40, 45, 50, 55, 59, 64];
    for (const id of Object.keys(SCALE_LIBRARY) as ScaleId[])
      for (const rootPc of [0, 4, 6, 7, 9, 10]) {
        const steps = SCALE_LIBRARY[id].steps;
        const pcs = new Set(steps.map((st) => (rootPc + st) % 12));
        const box = fretboardBox(rootPc, steps, tuning, firstBoxFret(rootPc));
        const run = [...box].sort((x, z) => z.string - x.string).flatMap((st) => st.frets.map((f) => tuning[6 - st.string]! + f));
        expect(run.length, id).toBeGreaterThan(steps.length);
        for (let i = 1; i < run.length; i++) {
          expect(run[i]! > run[i - 1]!, `${id} from ${rootPc}: ascending at ${i}`).toBe(true);
          for (let m = run[i - 1]! + 1; m < run[i]!; m++) expect(pcs.has(m % 12), `${id} from ${rootPc}: skips ${m} between ${run[i - 1]} and ${run[i]}`).toBe(false);
        }
      }
  });

  it('accents the paradiddle on the first stroke of each group', () => {
    const b = lessonById('b-rudimentos')!.blocks.find((x) => x.kind === 'rhythm' && x.caption === 'Paradiddle simples');
    expect(b?.kind === 'rhythm' && b.pattern.tracks.find((t) => t.label === 'Acento')!.pattern).toBe('x...x...');
  });

  it('marks beat 2 with the samba kick', () => {
    const b = lessonById('b-samba-pagode')!.blocks.find((x) => x.kind === 'rhythm');
    const kick = b?.kind === 'rhythm' ? b.pattern.tracks.find((t) => t.sound === 'kick')!.pattern : '';
    expect(kick[4]).toBe('x');
  });

  it('names the tritone in the Simpsons theme correctly and keeps titles true to their chords', () => {
    const all = JSON.stringify(LESSONS);
    expect(all).not.toMatch(/duas primeiras notas do tema de \\"Os Simpsons\\"/u);
    const samba = lessonById('s-samba-pagode')!.blocks.find((x) => x.kind === 'progression');
    expect(samba?.kind === 'progression' && samba.degrees.some((d) => d.includes('°'))).toBe(true);
  });
});
