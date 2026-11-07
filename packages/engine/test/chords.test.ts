import { describe, expect, it } from 'vitest';
import { buildChordSegments, smoothArgmax, windowFeatures } from '../src/chords/decode.ts';
import { toDisplayLabel, toMajMin } from '../src/chords/labels.ts';
import { chordVocab } from '../src/chords/vocab.ts';

describe('chord decoding', () => {
  it('has the 170-entry vocabulary ending in X and N', () => {
    expect(chordVocab).toHaveLength(170);
    expect(chordVocab.slice(0, 2)).toEqual(['C:min', 'C']);
    expect(chordVocab.slice(-2)).toEqual(['X', 'N']);
  });

  it('pads features into runs of 16 windows of 108 frames', () => {
    const cqt = { frameCount: 200, binCount: 144, data: new Float32Array(200 * 144).fill(1) };
    const runs = windowFeatures(cqt);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.length).toBe(16 * 108 * 144);
    expect(runs[0]![199 * 144]).toBe(1);
    expect(runs[0]![200 * 144]).toBe(0);
  });

  it('splits long inputs into several runs', () => {
    const frames = 16 * 108 + 5;
    const runs = windowFeatures({ frameCount: frames, binCount: 144, data: new Float32Array(frames * 144).fill(2) });
    expect(runs).toHaveLength(2);
    expect(runs[1]![4 * 144]).toBe(2);
    expect(runs[1]![5 * 144]).toBe(0);
  });

  it('smooths within a window and never across windows', () => {
    const logits = new Float32Array(216 * 170);
    for (let f = 0; f < 108; f++) logits[f * 170 + 1] = 1;
    for (let f = 108; f < 216; f++) logits[f * 170 + 0] = 1;
    const idx = smoothArgmax(logits, 216);
    expect(idx[107]).toBe(1);
    expect(idx[108]).toBe(0);
  });

  it('builds merged segments', () => {
    expect(buildChordSegments(Int32Array.from([1, 1, 0, 0, 0]), 0.1)).toEqual([
      { start: 0, end: 0.2, raw: 'C', label: 'C' },
      { start: 0.2, end: 0.5, raw: 'C:min', label: 'Cm' },
    ]);
    expect(buildChordSegments(new Int32Array(0), 0.1)).toEqual([]);
  });

  it.each([
    ['C:maj7', 'C7M'], ['F#:hdim7', 'F#m7(b5)'], ['A:min', 'Am'], ['G:7', 'G7'], ['D:dim', 'D°'], ['N', 'N.C.'],
    ['C:minmaj7', 'Cm(7M)'], ['E:dim7', 'E°7'], ['A#:aug', 'A#+'], ['B:sus4', 'Bsus4'], ['D:maj6', 'D6'], ['X', '?'],
  ])('labels %s as %s', (raw, label) => {
    expect(toDisplayLabel(raw)).toBe(label);
  });

  it('reduces to major/minor', () => {
    expect(toMajMin('A:min7')).toEqual({ pc: 9, quality: 'min' });
    expect(toMajMin('G:7')).toEqual({ pc: 7, quality: 'maj' });
    expect(toMajMin('F#:hdim7')).toEqual({ pc: 6, quality: 'min' });
    expect(toMajMin('N')).toBeNull();
    expect(toMajMin('X')).toBeNull();
  });
});
