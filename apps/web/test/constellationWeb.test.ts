import { describe, expect, it } from 'vitest';
import { chordName, parseChord } from '../src/constellation/harmony.ts';
import { focusOn, openFocus, orbit, preview, previewStars, resetWeb, startWeb, walk } from '../src/constellation/web.ts';

describe('constellation state', () => {
  it('starts with a lone chord and opens its orbit on demand', () => {
    const w = startWeb(parseChord('C7M')!);
    expect(Object.keys(w.nodes)).toHaveLength(1);
    expect(w.opened).toBe(false);
    expect(orbit(w)).toHaveLength(0);
    expect(orbit(openFocus(w)).length).toBeGreaterThanOrEqual(6);
  });

  it('walking marks the trail, moves the focus and keeps one node per chord', () => {
    let w = openFocus(startWeb(parseChord('C7M')!));
    const toDm7 = orbit(w).find((l) => chordName(l.move.to, w.center) === 'Dm7')!.move;
    w = walk(w, toDm7);
    expect(w.trail.map((k) => chordName(w.nodes[k]!.chord, w.center))).toEqual(['C7M', 'Dm7']);
    expect(w.focus).toBe(w.trail[1]);
    expect(Object.values(w.nodes).filter((n) => chordName(n.chord, w.center) === 'G7')).toHaveLength(1);
  });

  it('enharmonic chords are the same star (C#7 and Db7)', () => {
    let w = openFocus(startWeb(parseChord('C7M')!));
    const db7 = orbit(w).find((l) => chordName(l.move.to, w.center) === 'Db7')!;
    w = walk(w, db7.move);
    expect(Object.keys(w.nodes).filter((k) => k === '1:7')).toHaveLength(1);
    expect(w.focus).toBe('1:7');
  });

  it('preview shows a ring beyond the orbit', () => {
    const w = openFocus(startWeb(parseChord('C7M')!));
    expect(preview(w).length).toBeGreaterThan(orbit(w).length);
    const orbitKeys = new Set(orbit(w).map((l) => l.to));
    expect(preview(w).every((l) => orbitKeys.has(l.from))).toBe(true);
  });

  it('reset goes back to the start and focusOn continues from an opened star', () => {
    let w = openFocus(startWeb(parseChord('C7M')!));
    w = walk(w, orbit(w)[0]!.move);
    const back = focusOn(w, w.trail[0]!);
    expect(back.focus).toBe(w.trail[0]);
    expect(orbit(back).length).toBeGreaterThanOrEqual(6);
    expect(resetWeb(w).trail).toEqual([w.trail[0]]);
    expect(resetWeb(w).focus).toBe(w.trail[0]);
  });

  it('existing stars keep their positions when the web grows', () => {
    let w = openFocus(startWeb(parseChord('C7M')!));
    const before = structuredClone(w.nodes);
    w = walk(w, orbit(w)[0]!.move);
    for (const [k, n] of Object.entries(before)) expect([w.nodes[k]!.x, w.nodes[k]!.y]).toEqual([n.x, n.y]);
  });

  it('stars do not overlap', () => {
    let w = openFocus(startWeb(parseChord('C7M')!));
    for (let i = 0; i < 4; i++) w = walk(w, orbit(w)[0]!.move);
    const pts = Object.values(w.nodes);
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y)).toBeGreaterThan(60);
  });
});

describe('review fixes: preview ring', () => {
  it('a chord in the preview ring is one bubble, even when several neighbors lead to it', () => {
    const w = openFocus(startWeb(parseChord('C7M')!));
    const at = new Map<string, string>();
    for (const s of previewStars(w)) {
      const p = `${s.x},${s.y}`;
      if (at.has(s.key)) expect(p).toBe(at.get(s.key));
      else at.set(s.key, p);
    }
  });
});
