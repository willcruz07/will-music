import { describe, expect, it } from 'vitest';
import { guideEvents, guidesFor } from '../src/constellation/guides.ts';
import { chordKey, chordName, neighbors } from '../src/constellation/harmony.ts';
import { activeGuide, adoptCenter, focusOn, guidedNext, orbit, resetWeb, startGuidedWeb, walk } from '../src/constellation/web.ts';
import { chordNotes } from '../src/lib/chordNotation.ts';

describe('guided harmony and composed guide voices', () => {
  it('keeps melody and inverted bass inside each chord in all twelve keys and both modes', () => {
    for (let root = 0; root < 12; root++) for (const minor of [false, true]) {
      const center = { root, minor };
      for (const guide of guidesFor(center)) {
        for (const step of guide.steps) {
          const name = chordName(step.chord, center);
          const notes = chordNotes(name)!;
          expect(notes, name).not.toBeNull();
          expect(notes, `${guide.id}: melody over ${name}`).toContain((root + step.melody + 12) % 12);
          if (step.chord.bass !== undefined) expect(chordNotes(name.split('/')[0]!)!, name).toContain(step.chord.bass);
        }
        const events = guideEvents(guide, center);
        expect(events.every((event, i) => i === 0 || event.time >= events[i - 1]!.time)).toBe(true);
        for (const [i, step] of guide.steps.entries()) expect(events).toContainEqual({ time: i * 1.5, dur: 1.5 * 0.9, pitch: 72 + root + step.melody });
      }
    }
  });

  it('starts ii–V–I in the requested center, preserves the destination and highlights exact qualities', () => {
    let web = startGuidedWeb('ii-v-i', { root: 0, minor: false })!;
    expect(chordName(web.origin.chord, web.center)).toBe('Dm7');
    expect(web.center).toEqual({ root: 0, minor: false });
    expect(chordName(orbit(web)[0]!.move.to, web.center)).toBe('G7');
    web = walk(web, guidedNext(web)!);
    expect(chordName(web.nodes[web.focus]!.resolvesTo!, web.center)).toBe('C7M');
    web = walk(web, guidedNext(web)!);
    expect(guidedNext(web)).toBeNull();
    expect(web.visits.map(v => chordName(v.chord, v.center))).toEqual(['Dm7', 'G7', 'C7M']);
    expect(resetWeb(web).center).toEqual({ root: 0, minor: false });
    expect(resetWeb(web).guide!.cursor).toBe(0);
    const back = focusOn(web, web.trail[1]!, 1);
    expect(chordName(guidedNext(back)!.to, back.center)).toBe('C7M');
    expect(adoptCenter(web, { root: 7, minor: false }).guide).toBeUndefined();
  });

  it('follows every complete template, including consecutive qualities of the same graph node', () => {
    for (const minor of [false, true]) for (const guide of guidesFor({ root: 0, minor })) {
      let web = startGuidedWeb(guide.id, { root: 0, minor })!;
      for (let i = 1; i < guide.steps.length; i++) {
        web = walk(web, guidedNext(web)!);
        expect(web.guide?.cursor, guide.id).toBe(i);
      }
      expect(web.visits.map(v => chordName(v.chord, v.center))).toEqual(guide.steps.map(s => chordName(s.chord, web.center)));
      expect(activeGuide(web)?.id).toBe(guide.id);
      expect(guidedNext(web)).toBeNull();
    }
  });

  it('releases the guide when the student chooses another chord, retaining the visited path', () => {
    const web = startGuidedWeb('ii-v-i', { root: 0, minor: false })!;
    const alternative = neighbors(web.origin.chord, web.center).find(m => chordKey(m.to) !== chordKey(guidedNext(web)!.to))!;
    const next = walk(web, alternative);
    expect(next.guide).toBeUndefined();
    expect(next.visits).toHaveLength(2);
    expect(web.visits).toHaveLength(1);
  });
});
