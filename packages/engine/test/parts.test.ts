import { describe, expect, it } from 'vitest';
import type { KeyResult } from '../src/key/key.ts';
import { buildDrumXml, buildPianoXml, splitHands, toChords } from '../src/score/parts.ts';

const key = (root: string, mode: 'major' | 'minor'): KeyResult => ({ root, mode, label: `${root} ${mode}`, index: 0, margin: 1 });

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

/** Sum of note durations per staff in each measure (chord tones and backups excluded). */
const staffTotals = (xml: string) =>
  xml
    .split('<measure ')
    .slice(1)
    .map((m) => {
      const totals: Record<string, number> = {};
      for (const note of m.split('<note>').slice(1)) {
        if (note.startsWith('<chord/>')) continue;
        const dur = Number(/<duration>(\d+)<\/duration>/.exec(note)![1]);
        const staff = /<staff>(\d)<\/staff>/.exec(note)?.[1] ?? '1';
        totals[staff] = (totals[staff] ?? 0) + dur;
      }
      return totals;
    });

describe('piano part', () => {
  it('groups simultaneous notes into chords', () => {
    const chords = toChords([
      { pitch: 60, start: 0, dur: 4 },
      { pitch: 64, start: 0, dur: 6 },
      { pitch: 67, start: 2, dur: 4 },
    ]);
    expect(chords).toEqual([
      { start: 0, dur: 2, pitches: [60, 64] },
      { start: 2, dur: 4, pitches: [67] },
    ]);
  });

  it('splits the hands at middle C', () => {
    const { right, left } = splitHands([
      { pitch: 48, start: 0, dur: 4 },
      { pitch: 60, start: 0, dur: 4 },
      { pitch: 72, start: 4, dur: 4 },
    ]);
    expect(right.map((n) => n.pitch)).toEqual([60, 72]);
    expect(left.map((n) => n.pitch)).toEqual([48]);
  });

  it('writes a grand staff with treble and bass clefs, the key and full measures', () => {
    const xml = buildPianoXml({
      title: 'Hino',
      artist: '',
      bpm: 90,
      key: key('D', 'major'),
      notes: [
        { pitch: 62, start: 0, dur: 4 },
        { pitch: 66, start: 0, dur: 4 },
        { pitch: 50, start: 0, dur: 8 },
        { pitch: 69, start: 14, dur: 6 },
      ],
      harmonies: [{ tick: 0, raw: 'D' }],
    });
    expect(balanced(xml)).toBe(true);
    expect(xml).toContain('<staves>2</staves>');
    expect(xml).toMatch(/<clef number="1"><sign>G<\/sign><line>2<\/line><\/clef><clef number="2"><sign>F<\/sign><line>4<\/line><\/clef>/);
    expect(xml).toContain('<fifths>2</fifths>');
    expect(xml).toContain('<chord/>');
    expect(xml).toContain('<backup><duration>16</duration></backup>');
    expect(xml).toMatch(/<step>F<\/step><alter>1<\/alter>/);
    for (const totals of staffTotals(xml)) expect(totals).toEqual({ '1': 16, '2': 16 });
  });
});

describe('drum part', () => {
  it('writes kick, snare and hi-hat on a percussion staff', () => {
    const xml = buildDrumXml({
      title: 'Groove',
      artist: '',
      bpm: 100,
      hits: [
        { tick: 0, kind: 'kick' },
        { tick: 0, kind: 'hihat' },
        { tick: 2, kind: 'hihat' },
        { tick: 4, kind: 'snare' },
        { tick: 18, kind: 'kick' },
      ],
    });
    expect(balanced(xml)).toBe(true);
    expect(xml).toContain('<sign>percussion</sign>');
    expect(xml).toMatch(/<unpitched><display-step>F<\/display-step><display-octave>4<\/display-octave><\/unpitched>/);
    expect(xml).toMatch(/<unpitched><display-step>C<\/display-step><display-octave>5<\/display-octave><\/unpitched>/);
    expect(xml).toContain('<notehead>x</notehead>');
    expect(xml).toContain('<midi-unpitched>37</midi-unpitched>');
    for (const totals of staffTotals(xml)) expect(totals['1']).toBe(16);
  });

  it('is a valid empty score without hits', () => {
    const xml = buildDrumXml({ title: 'x', artist: '', bpm: 100, hits: [] });
    expect(balanced(xml)).toBe(true);
    expect(xml).toContain('<rest measure="yes"/>');
  });
});
