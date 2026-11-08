import { describe, expect, it } from 'vitest';
import { type Chord, chordKey, neighbors } from '../src/constellation/harmony.ts';
import { suggestRoute } from '../src/constellation/route.ts';

const C = { root: 0, minor: false };
const Bb7M: Chord = { root: 10, quality: '7M' };

describe('target mode: suggestRoute', () => {
  it('finds a musical path from C to Bb7M, every step a real neighbor', () => {
    const route = suggestRoute({ root: 0, quality: '7M' }, C, Bb7M)!;
    expect(route.length).toBeGreaterThanOrEqual(2);
    expect(route.length).toBeLessThanOrEqual(8);
    expect(chordKey(route.at(-1)!.to)).toBe(chordKey(Bb7M));
    let at = { chord: { root: 0, quality: '7M' } as Chord, center: C };
    for (const step of route) {
      expect(neighbors(at.chord, at.center).some((m) => chordKey(m.to) === chordKey(step.to))).toBe(true);
      at = { chord: step.to, center: step.nextCenter };
    }
    expect(route.some((s) => s.kind === 'iiV' || s.kind === 'cadencia' || s.kind === 'cadeia')).toBe(true);
  });

  it('returns [] when already at the target and null when unreachable in the step limit', () => {
    expect(suggestRoute(Bb7M, { root: 10, minor: false }, Bb7M)).toEqual([]);
    expect(suggestRoute({ root: 0, quality: '7M' }, C, { root: 6, quality: 'm(7M)' }, 1)).toBeNull();
  });

  it('reaches every major 7M target from C within the limit', () => {
    for (let root = 0; root < 12; root++) {
      if (root === 0) continue;
      expect(suggestRoute({ root: 0, quality: '7M' }, C, { root, quality: '7M' }), `alvo ${root}`).not.toBeNull();
    }
  });
});

describe('target mode: musical arrival', () => {
  it('arrives at the target by resolving a dominant', () => {
    const route = suggestRoute({ root: 0, quality: '7M' }, C, Bb7M)!;
    expect(route.at(-1)!.kind).toBe('cadencia');
  });
});
