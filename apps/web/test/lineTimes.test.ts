import { describe, expect, it } from 'vitest';
import { lyricTexts, remapLineTimes, resolveLineTimes } from '../src/lib/lineTimes.ts';

const before = '[G]um\n[D]dois\ntrês\nquatro';

describe('line times', () => {
  it('keeps times of unchanged and edited-in-place lines', () => {
    expect(remapLineTimes(before, '[G]um\n[C]dois!\ntrês\nquatro', [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  it('drops deleted lines and nulls inserted ones', () => {
    expect(remapLineTimes(before, '[G]um\ntrês\nnova\nquatro', [1, 2, 3, 4])).toEqual([1, 3, null, 4]);
  });

  it('handles a split line', () => {
    expect(remapLineTimes('um dois\ntrês', 'um\ndois\ntrês', [1, 5])).toEqual([1, null, 5]);
  });

  it('interpolates missing times', () => {
    expect(resolveLineTimes([1, null, null, 7])).toEqual([1, 3, 5, 7]);
    expect(resolveLineTimes([null, 10, null])).toEqual([6, 10, 14]);
    expect(resolveLineTimes([null, null])).toEqual([0, 4]);
    expect(resolveLineTimes([])).toEqual([]);
  });

  it('ignores chords and comments when matching', () => {
    expect(lyricTexts('{comment: Intro}\n[G] [D]\n[G]Nin[D]guém  explica')).toEqual(['Ninguém explica']);
  });
});

describe('chart line times with fallback', () => {
  it('uses chart.lineTimes, else the analysis lyric times', async () => {
    const { chartLineStarts } = await import('../src/lib/lineTimes.ts');
    expect(chartLineStarts({ chordPro: 'a\nb', lineTimes: [2, null] }, undefined)).toEqual([2, 6]);
    expect(chartLineStarts({ chordPro: 'a\nb' }, [{ start: 3, text: 'a' }, { start: 9, text: 'b' }])).toEqual([3, 9]);
    expect(chartLineStarts(undefined, undefined)).toEqual([]);
  });
});
