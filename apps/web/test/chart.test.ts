import type { ChordSegment, KeyResult } from '@will-music/engine';
import { describe, expect, it } from 'vitest';
import { buildChart, keyToChord, parseChordPro } from '../src/lib/chart.ts';

const seg = (start: number, end: number, raw: string, label = raw): ChordSegment => ({ start, end, raw, label });
const key = (root: string, mode: 'major' | 'minor'): KeyResult => ({ root, mode, label: `${root} ${mode}`, index: 0, margin: 0 });

describe('chart generation', () => {
  it('places chords on word starts by time', () => {
    const cho = buildChart({ title: 'T', artist: 'A', key: key('G', 'major'), chords: [seg(0, 7, 'G'), seg(7, 12, 'D')], lines: [{ start: 2, text: 'Ninguém explica Deus' }, { start: 10, text: 'fim' }] });
    expect(cho).toContain('{title: T}');
    expect(cho).toContain('{key: G}');
    expect(cho).toContain('{comment: Intro}');
    expect(cho).toContain('[G]Ninguém explica [D]Deus');
    expect(cho).toContain('[D]fim');
  });

  it('keeps instrumental gaps and the ending', () => {
    const cho = buildChart({
      title: 'T', artist: 'A', key: key('A', 'minor'),
      chords: [seg(0, 6, 'A:min'), seg(6, 20, 'F'), seg(20, 31, 'C'), seg(31, 40, 'G'), seg(40, 50, 'E:7')],
      lines: [{ start: 5, text: 'um' }, { start: 30, text: 'dois' }],
    });
    expect(cho).toContain('{key: Am}');
    expect(cho).toContain('{comment: Instrumental}');
    expect(cho).toContain('{comment: Final}');
    expect(cho).toContain('[E7]');
  });

  it('generates a chart without lyrics', () => {
    const cho = buildChart({ title: 'T', artist: '', key: key('G', 'major'), chords: [seg(0, 3, 'G'), seg(3, 3.2, 'C'), seg(3.2, 6, 'D'), seg(6, 7, 'N')], lines: [] });
    expect(cho).toContain('[G] [D]');
    expect(cho).not.toContain('[C]');
    expect(cho).not.toContain('undefined');
  });

  it('converts keys to chord names', () => {
    expect(keyToChord(key('F#', 'minor'))).toBe('F#m');
    expect(keyToChord(key('Bb', 'major'))).toBe('Bb');
  });

  it('parses ChordPro lines', () => {
    const p = parseChordPro('{title: T}\n{comment: Intro}\n[G] [D]\n[G]Ninguém [D]Deus\nsem acorde');
    expect(p.meta.title).toBe('T');
    expect(p.lines[0]).toEqual({ kind: 'comment', text: 'Intro' });
    expect(p.lines[1]).toEqual({ kind: 'chords', chords: ['G', 'D'] });
    expect(p.lines[2]).toEqual({ kind: 'lyric', parts: [{ chord: 'G', text: 'Ninguém ' }, { chord: 'D', text: 'Deus' }] });
    expect(p.lines[3]).toEqual({ kind: 'lyric', parts: [{ text: 'sem acorde' }] });
  });
});
