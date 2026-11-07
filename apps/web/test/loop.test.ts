import { describe, expect, it } from 'vitest';
import { normalizeLoop } from '../src/lib/loop.ts';

describe('A-B loop', () => {
  it('orders, clamps and rejects tiny or incomplete loops', () => {
    expect(normalizeLoop(10, 5, 100)).toEqual({ a: 5, b: 10 });
    expect(normalizeLoop(95, 120, 100)).toEqual({ a: 95, b: 100 });
    expect(normalizeLoop(5, 5.5, 100)).toBeNull();
    expect(normalizeLoop(null, 10, 100)).toBeNull();
    expect(normalizeLoop(-3, 4, 100)).toEqual({ a: 0, b: 4 });
  });
});
