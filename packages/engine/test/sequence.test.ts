import { describe, expect, it } from 'vitest';
import type { ChordSegment } from '../src/chords/decode.ts';
import { compareKeys, lcsScore, parseReferenceChord, simplifySegments } from '../src/eval/sequence.ts';
import type { KeyResult } from '../src/key/key.ts';

describe('Phase 0 evaluation', () => {
  it.each([
    ['C7M', 0, 'maj'], ['F#m7(b5)', 6, 'min'], ['C/E', 0, 'maj'], ['Bb', 10, 'maj'], ['A#m', 10, 'min'],
    ['C°', 0, 'min'], ['G4', 7, 'maj'], ['Dsus4', 2, 'maj'], ['Cmaj7', 0, 'maj'], ['Em7/D', 4, 'min'],
    ['E7(9)', 4, 'maj'], ['Cdim', 0, 'min'], ['Db', 1, 'maj'], ['B5', 11, 'maj'],
  ])('parses %s', (text, pc, quality) => {
    expect(parseReferenceChord(text)).toEqual({ pc, quality });
  });

  it('treats N.C. as no chord and rejects garbage', () => {
    expect(parseReferenceChord('N.C.')).toBeNull();
    expect(() => parseReferenceChord('H7')).toThrow(/H7/);
  });

  it('drops short and empty segments then merges repeats', () => {
    const s = (start: number, end: number, raw: string): ChordSegment => ({ start, end, raw, label: raw });
    expect(simplifySegments([s(0, 2, 'C'), s(2, 2.3, 'G'), s(2.3, 4, 'C'), s(4, 5, 'N'), s(5, 7, 'A:min')])).toEqual([
      { pc: 0, quality: 'maj' },
      { pc: 9, quality: 'min' },
    ]);
  });

  it('scores by longest common subsequence', () => {
    const C = { pc: 0, quality: 'maj' as const };
    const G = { pc: 7, quality: 'maj' as const };
    const Am = { pc: 9, quality: 'min' as const };
    const F = { pc: 5, quality: 'maj' as const };
    expect(lcsScore([C, G, Am, F], [C, Am, G, Am, F, C])).toEqual({ lcs: 4, recall: 1, precision: 4 / 6 });
    expect(lcsScore([], [C])).toEqual({ lcs: 0, recall: 0, precision: 0 });
  });

  const key = (root: string, mode: 'major' | 'minor'): KeyResult => ({ root, mode, label: `${root} ${mode}`, index: 0, margin: 0 });
  it.each([
    [{ root: 'A', mode: 'major' }, key('A', 'major'), 'exact'],
    [{ root: 'A', mode: 'major' }, key('F#', 'minor'), 'relative'],
    [{ root: 'F#', mode: 'minor' }, key('A', 'major'), 'relative'],
    [{ root: 'G', mode: 'major' }, key('D', 'major'), 'fifth'],
    [{ root: 'G', mode: 'major' }, key('E', 'major'), 'wrong'],
    [{ root: 'A#', mode: 'major' }, key('Bb', 'major'), 'exact'],
  ] as const)('compares keys %o vs %o', (ref, predicted, out) => {
    expect(compareKeys(ref, predicted)).toBe(out);
  });
});
