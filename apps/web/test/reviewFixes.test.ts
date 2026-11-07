import type { ChordSegment, KeyResult } from '@will-music/engine';
import { describe, expect, it } from 'vitest';
import { buildChart, parseChordPro } from '../src/lib/chart.ts';
import { parseLrc } from '../src/lib/lrclib.ts';

const seg = (start: number, end: number, raw: string): ChordSegment => ({ start, end, raw, label: raw });
const key: KeyResult = { root: 'C', mode: 'major', label: 'C major', index: 3, margin: 0 };
const chordsOf = (cho: string, lineText: string) => {
  const line = parseChordPro(cho).lines.find((l) => l.kind === 'lyric' && l.parts.map((p) => p.text).join('').includes(lineText));
  return line && line.kind === 'lyric' ? line.parts.filter((p) => p.chord).map((p) => p.chord) : [];
};

describe('review fixes: chart generation', () => {
  it('keeps chords in time order inside a line', () => {
    const cho = buildChart({ title: 't', artist: '', key, chords: [seg(0, 2.91, 'C'), seg(2.91, 3.7, 'G'), seg(3.7, 8, 'A:min')], lines: [{ start: 0, text: 'Eu sei que vai' }, { start: 8, text: 'fim' }] });
    expect(chordsOf(cho, 'Eu sei')).toEqual(['C', 'G', 'Am']);
  });

  it('never drops chords on short lines', () => {
    const cho = buildChart({ title: 't', artist: '', key, chords: [seg(9, 11, 'G'), seg(11, 13, 'D'), seg(13, 16, 'A')], lines: [{ start: 10, text: 'Amor' }, { start: 14, text: 'fim' }] });
    expect(chordsOf(cho, 'Amor')).toEqual(['G', 'D', 'A']);
  });

  it('keeps section tags in lyrics as text, not chords', () => {
    const cho = buildChart({ title: 't', artist: '', key, chords: [seg(0, 10, 'C')], lines: [{ start: 1, text: '[Refrão]' }, { start: 5, text: 'Santo' }] });
    const lyric = parseChordPro(cho).lines.filter((l) => l.kind === 'lyric');
    expect(lyric).toHaveLength(2);
    expect(cho).toContain('(Refrão)');
  });

  it('expands LRC lines with several timestamps', () => {
    expect(parseLrc('[00:12.00][01:30.00] Aleluia\n[00:20.00] Outra')).toEqual([
      { start: 12, text: 'Aleluia' },
      { start: 20, text: 'Outra' },
      { start: 90, text: 'Aleluia' },
    ]);
  });
});
