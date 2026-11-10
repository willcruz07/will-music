import { describe, expect, it } from 'vitest';
import { decodeLvChords, estimateLvTuning, LV_WIDTHS } from '../src/chords/lvBrowser.ts';
import { toDisplayLabel } from '../src/chords/labels.ts';

describe('advanced chord decoding', () => {
  it('retains the upstream initial no-chord frame and then follows sustained evidence', () => {
    const frames = 6;
    const probabilities = LV_WIDTHS.map((width) => new Float32Array(frames * width).fill(0.01));
    for (let frame = 0; frame < frames; frame++) {
      probabilities[0]![frame * 73 + 1] = 0.99;
      probabilities[0]![frame * 73] = 1e-20;
    }
    const result = decodeLvChords(probabilities, frames, [
      { raw: 'N', label: 'N.C.', indices: [0, 0, -1, -1, -1, -1] },
      { raw: 'C:maj', label: 'C', indices: [1, 0, -1, -1, -1, -1] },
    ]);
    expect(result.map((segment) => segment.raw)).toEqual(['N', 'C:maj']);
    expect(result[1]!.start).toBeCloseTo(512 / 22050);
    expect(result[1]!.end).toBeCloseTo(frames * 512 / 22050);
  });

  it('returns neutral tuning for silence', () => expect(estimateLvTuning(new Float32Array(22050))).toBe(0));
  it('rejects inconsistent tensor lengths', () => expect(() => decodeLvChords([], 1, [])).toThrow());
  it.each([
    ['C:maj/3', 'C/E'], ['C:maj/5', 'C/G'], ['F:maj/2', 'F/G'],
    ['B:hdim7', 'Bm7(b5)'], ['C:7(13)', 'C7(13)'], ['C:min11', 'Cm7(9,11)'],
    ['G:7(b9)', 'G7(b9)'], ['C:maj7(#11)', 'C7M(#11)'], ['C:9', 'C7(9)'],
  ])('converts %s to %s', (raw, label) => expect(toDisplayLabel(raw)).toBe(label));
});
