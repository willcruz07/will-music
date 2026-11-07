import { describe, expect, it } from 'vitest';
import { parseReferenceChord } from '../src/eval/sequence.ts';
import { estimateKeyFromChords } from '../src/key/key.ts';

const seg = (start: number, end: number, raw: string) => ({ start, end, raw, label: raw });

describe('review fixes: engine', () => {
  it('reads the Brazilian º (U+00BA) as diminished', () => {
    expect(parseReferenceChord('Cº')).toEqual({ pc: 0, quality: 'min' });
    expect(parseReferenceChord('Bº7')).toEqual({ pc: 11, quality: 'min' });
  });

  it('estimates the key from chords when S-KEY is unavailable', () => {
    expect(estimateKeyFromChords([seg(0, 4, 'C'), seg(4, 8, 'G'), seg(8, 10, 'A:min'), seg(10, 12, 'F')]).label).toBe('C major');
    expect(estimateKeyFromChords([seg(0, 4, 'A:min'), seg(4, 6, 'D:min'), seg(6, 8, 'E:7'), seg(8, 12, 'A:min')]).label).toBe('A minor');
    expect(estimateKeyFromChords([seg(0, 4, 'G'), seg(4, 8, 'D'), seg(8, 10, 'E:min'), seg(10, 14, 'C')]).label).toBe('G major');
  });
});
