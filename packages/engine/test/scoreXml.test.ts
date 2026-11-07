import { describe, expect, it } from 'vitest';
import type { KeyResult } from '../src/key/key.ts';
import { buildMusicXml, keyFifths } from '../src/score/musicxml.ts';
import { buildGrid, chordsToHarmony, quantize } from '../src/score/quantize.ts';
import { assignFrets } from '../src/score/tab.ts';
import { estimateTempo } from '../src/score/tempo.ts';

const key = (root: string, mode: 'major' | 'minor'): KeyResult => ({ root, mode, label: `${root} ${mode}`, index: 0, margin: 1 });

/** Minimal well-formedness check: every opened tag is closed in order. */
const balanced = (xml: string): boolean => {
  const stack: string[] = [];
  for (const m of xml.replace(/<\?[^>]*\?>|<!DOCTYPE[^>]*>/g, '').matchAll(/<(\/?)([a-zA-Z-]+)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
};

const measures = (xml: string, part: string) => xml.split(`<part id="${part}">`)[1]!.split('</part>')[0]!.split('<measure ').slice(1);

describe('estimateTempo', () => {
  it('finds 120 BPM from quarter-note onsets', () => {
    const onsets = Array.from({ length: 40 }, (_, i) => 1 + i * 0.5 + (i % 3 === 0 ? 0.01 : -0.01));
    expect(estimateTempo(onsets)).toBeGreaterThanOrEqual(118);
    expect(estimateTempo(onsets)).toBeLessThanOrEqual(122);
  });

  it('falls back to 100 with too few notes', () => {
    expect(estimateTempo([1, 2])).toBe(100);
  });
});

describe('quantize', () => {
  it('snaps jittered onsets to the grid without overlaps', () => {
    const notes = Array.from({ length: 8 }, (_, i) => ({ pitch: 60 + i, start: i * 0.5 + (i % 2 ? 0.03 : -0.02) + 0.03, end: i * 0.5 + 0.55, velocity: 0.8 }));
    const grid = buildGrid(120, notes.map((n) => n.start), []);
    const q = quantize(notes, grid);
    expect(q).toHaveLength(8);
    for (let i = 1; i < q.length; i++) {
      expect(q[i]!.start - q[i - 1]!.start).toBe(4);
      expect(q[i - 1]!.start + q[i - 1]!.dur).toBeLessThanOrEqual(q[i]!.start);
    }
  });

  it('turns chord segments into harmonies, skipping N and X', () => {
    const grid = buildGrid(120, [], [0, 2]);
    const h = chordsToHarmony(
      [
        { start: 0, end: 2, raw: 'C:maj7', label: 'C7M' },
        { start: 2, end: 3, raw: 'N', label: 'N.C.' },
        { start: 3, end: 4, raw: 'A:min', label: 'Am' },
      ],
      grid,
    );
    expect(h.map((x) => x.raw)).toEqual(['C:maj7', 'A:min']);
    expect(h[1]!.tick - h[0]!.tick).toBe(24);
  });
});

describe('assignFrets', () => {
  it('plays low E open on the sixth string', () => {
    expect(assignFrets([40])).toEqual([{ string: 6, fret: 0, pitch: 40 }]);
  });

  it('moves notes outside the guitar range by octaves', () => {
    expect(assignFrets([30])[0]).toEqual({ string: 6, fret: 2, pitch: 42 });
    expect(assignFrets([100])[0]!.pitch).toBe(76);
  });

  it('keeps a scale in one hand position', () => {
    const frets = assignFrets([60, 62, 64, 65, 67, 69]).map((f) => f.fret).filter((f) => f > 0);
    expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(5);
  });
});

describe('buildMusicXml', () => {
  const base = { title: 'Teste & cia', artist: 'Banda', bpm: 120, key: key('C', 'major'), harmonies: [] };

  it('writes key signatures for major and minor keys', () => {
    expect(keyFifths(key('Bb', 'major'))).toBe(-2);
    expect(keyFifths(key('A', 'minor'))).toBe(0);
    expect(keyFifths(key('E', 'major'))).toBe(4);
    expect(keyFifths(key('C', 'minor'))).toBe(-3);
    expect(keyFifths(undefined)).toBe(0);
  });

  it('produces a well-formed lead sheet with escaped title and a full-bar rest', () => {
    const xml = buildMusicXml({ ...base, notes: [], tab: false });
    expect(balanced(xml)).toBe(true);
    expect(xml).toContain('Teste &amp; cia');
    expect(xml).toContain('<rest measure="yes"/>');
    expect(xml).not.toContain('<part id="P2">');
  });

  it('ties a note across the barline', () => {
    const xml = buildMusicXml({ ...base, notes: [{ pitch: 60, start: 14, dur: 6 }], tab: false });
    const [first, second] = measures(xml, 'P1');
    expect(first).toContain('<tie type="start"/>');
    expect(second).toContain('<tie type="stop"/>');
    expect(balanced(xml)).toBe(true);
  });

  it('splits odd durations into tied notes', () => {
    const xml = buildMusicXml({ ...base, notes: [{ pitch: 62, start: 0, dur: 5 }], tab: false });
    const bar = measures(xml, 'P1')[0]!;
    expect(bar.match(/<step>D<\/step>/g)).toHaveLength(2);
    expect(bar).toContain('<type>quarter</type>');
    expect(bar).toContain('<type>16th</type>');
  });

  it('spells notes with flats in flat keys', () => {
    const xml = buildMusicXml({ ...base, key: key('Bb', 'major'), notes: [{ pitch: 70, start: 0, dur: 4 }], tab: false });
    expect(xml).toMatch(/<step>B<\/step>\s*<alter>-1<\/alter>\s*<octave>4<\/octave>/);
  });

  it('writes chord symbols', () => {
    const xml = buildMusicXml({ ...base, notes: [], harmonies: [{ tick: 0, raw: 'C:maj7' }, { tick: 8, raw: 'F#:min' }], tab: false });
    expect(xml).toContain('<kind>major-seventh</kind>');
    expect(xml).toMatch(/<root-step>F<\/root-step>\s*<root-alter>1<\/root-alter>/);
    expect(xml).toContain('<kind>minor</kind>');
  });

  it('adds a guitar tab staff with strings and frets', () => {
    const xml = buildMusicXml({ ...base, notes: [{ pitch: 64, start: 0, dur: 4 }], tab: true });
    expect(xml).toContain('<part id="P2">');
    expect(xml).toContain('<sign>TAB</sign>');
    expect(xml).toMatch(/<string>1<\/string>\s*<fret>0<\/fret>/);
    expect(balanced(xml)).toBe(true);
  });

  it('drops empty bars before the music starts', () => {
    const xml = buildMusicXml({ ...base, notes: [{ pitch: 60, start: 36, dur: 4 }], harmonies: [{ tick: 34, raw: 'C' }], tab: false });
    const bars = measures(xml, 'P1');
    expect(bars).toHaveLength(1);
    expect(bars[0]).toContain('<step>C</step>');
    expect(bars[0]).toContain('<attributes>');
  });
});
