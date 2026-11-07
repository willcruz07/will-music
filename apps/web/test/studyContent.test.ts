import { describe, expect, it } from 'vitest';
import { chordNotes } from '../src/lib/chordNotation.ts';
import { LESSONS, TRACKS, trackLessons } from '../src/study/catalog.ts';
import { SCALE_LIBRARY, parseTab, romanToChord } from '../src/study/theory.ts';
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
