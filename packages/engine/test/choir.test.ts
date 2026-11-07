import { describe, expect, it } from 'vitest';
import { buildChoirXml, splitVoices } from '../src/score/choir.ts';

const n = (pitch: number, start: number, end = start + 0.9) => ({ pitch, start, end, velocity: 0.8 });

describe('splitVoices', () => {
  it('gives the four notes of a chord to S, A, T and B from top to bottom', () => {
    const v = splitVoices([n(72, 0), n(64, 0), n(55, 0), n(48, 0)]);
    expect([v.S, v.A, v.T, v.B].map((x) => x.map((y) => y.pitch))).toEqual([[72], [64], [55], [48]]);
  });

  it('follows each voice by its closest next note (no crossing)', () => {
    const v = splitVoices([n(72, 0), n(64, 0), n(55, 0), n(48, 0), n(74, 1), n(65, 1), n(55, 1), n(43, 1)]);
    expect(v.S.map((x) => x.pitch)).toEqual([72, 74]);
    expect(v.B.map((x) => x.pitch)).toEqual([48, 43]);
  });

  it('puts a lone low note in the bass and a lone high note in the soprano', () => {
    expect(splitVoices([n(45, 0)]).B).toHaveLength(1);
    expect(splitVoices([n(79, 0)]).S).toHaveLength(1);
  });

  it('keeps every voice monophonic', () => {
    const v = splitVoices([n(72, 0, 2), n(74, 1, 2)]);
    for (let i = 1; i < v.S.length; i++) expect(v.S[i]!.start).toBeGreaterThanOrEqual(v.S[i - 1]!.end);
  });
});

describe('buildChoirXml', () => {
  const voices = { S: [{ pitch: 72, start: 0, dur: 4 }], A: [{ pitch: 64, start: 0, dur: 4 }], T: [{ pitch: 55, start: 0, dur: 4 }], B: [] };

  it('writes four parts with the right clefs (tenor an octave below the treble clef)', () => {
    const xml = buildChoirXml({ title: 'Hino', artist: '', bpm: 80, voices, harmonies: [], lyrics: [] });
    expect(xml.match(/<score-part id=/g)).toHaveLength(4);
    expect(xml).toContain('<part-name>Soprano</part-name>');
    expect(xml).toContain('<part-name>Contralto</part-name>');
    expect(xml).toMatch(/<part-name>Tenor<\/part-name>/);
    expect(xml).toMatch(/<clef><sign>G<\/sign><line>2<\/line><clef-octave-change>-1<\/clef-octave-change><\/clef>/);
    expect(xml).toMatch(/<clef><sign>F<\/sign><line>4<\/line><\/clef>/);
    expect(xml).toContain('<rest measure="yes"/>');
  });

  it('shows the lyric lines above the soprano where they start', () => {
    const xml = buildChoirXml({ title: 'Hino', artist: '', bpm: 80, voices, harmonies: [], lyrics: [{ tick: 0, text: 'Santo, santo & bom' }] });
    expect(xml).toContain('<words>Santo, santo &amp; bom</words>');
  });
});
