import { describe, expect, it } from 'vitest';
import { chordName, commonTones, neighbors, parseChord } from '../src/constellation/harmony.ts';
import { adoptCenter, focusOn, openFocus, orbit, previewStars, resetWeb, startWeb, walk, type Web } from '../src/constellation/web.ts';
import { constellationEvents } from '../src/constellation/voicing.ts';
import { chordNotes } from '../src/lib/chordNotation.ts';

const C = { root: 0, minor: false };
const step = (web: Web, name: string) => walk(web, orbit(web).flatMap(link => link.move.options).find(move => chordName(move.to, move.nextCenter) === name)!);
const names = (web: Web) => web.visits.map(visit => chordName(visit.chord, visit.center));

describe('Constelação: musical coherence regressions', () => {
  it('preserves occurrences, returns to the requested visit and resets the original quality', () => {
    let web = openFocus(startWeb(parseChord('C7M')!));
    for (const name of ['G7', 'C7M', 'G7(b9)', 'C']) web = step(web, name);
    expect(names(web)).toEqual(['C7M', 'G7', 'C7M', 'G7(b9)', 'C']);
    expect(names(focusOn(web, '7:dom', 1))).toEqual(['C7M', 'G7']);
    expect(names(resetWeb(web))).toEqual(['C7M']);
  });
  it('bases previews on the current suggested chord, not an earlier variation stored in its node', () => {
    let web = openFocus(startWeb(parseChord('C7M')!));
    web = step(step(web, 'G7(b9)'), 'C7M');
    const expected = neighbors(parseChord('G7')!, C).filter(move => move.to.root !== 0 || move.motion === 'resolve').slice(0, 4).map(move => chordName(move.to, move.nextCenter));
    expect(previewStars(web).filter(star => star.from === '7:dom').map(star => chordName(star.chord, star.center))).toEqual(expected);
  });
  it('adopts a new reference explicitly and restores the previous reference on return', () => {
    let web = step(openFocus(startWeb(parseChord('C')!)), 'Dm7');
    expect(web.center).toEqual(C);
    web = adoptCenter(web, { root: 2, minor: true });
    expect(web.center).toEqual({ root: 2, minor: true });
    expect(focusOn(web, web.trail[0]!, 0).center).toEqual(C);
  });
  it('retains the substitute destination in every offered dominant variation', () => {
    const sub = neighbors(parseChord('C7M')!, C).find(move => move.to.root === 1 && move.to.quality === '7')!;
    for (const variation of sub.options.filter(move => move.resolvesTo)) {
      expect(variation.resolvesTo?.root).toBe(0);
      expect(variation.why).not.toContain('Gb maior');
      expect(neighbors(variation.to, C, variation.resolvesTo).some(move => move.to.root === 0 && move.motion === 'resolve')).toBe(true);
    }
  });
  it('measures common tones and gives suspended chords their actual transformation', () => {
    expect(commonTones(parseChord('C6')!, parseChord('Em7')!, C)).toHaveLength(2);
    expect(commonTones(parseChord('C7M(9)')!, parseChord('Em7')!, C)).toHaveLength(4);
    const moves = neighbors(parseChord('G7sus4')!, C);
    expect(moves.some(move => chordName(move.to, C) === 'G7')).toBe(true);
    expect(moves.map(move => move.why).join(' ')).not.toContain('trítono se desfaz');
  });
  it('keeps every formula tone and the requested bass in the synthesized study progression', () => {
    const chords = ['C', 'C/E', 'C+', 'Fm', 'G7(b9,b13)', 'C7M'];
    const events = constellationEvents(chords, 120, 2);
    chords.forEach((chord, index) => {
      const notes = events.filter(event => event.time === index).map(event => event.pitch!);
      expect([...new Set(notes.map(note => note % 12))].sort()).toEqual([...new Set(chordNotes(chord)!)].sort());
      expect(Math.min(...notes) % 12).toBe(chordNotes(chord)![0]);
    });
  });
});
