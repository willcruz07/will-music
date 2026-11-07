import { describe, expect, it } from 'vitest';
import { nextBarsHidden } from '../src/lib/scrollBars.ts';

describe('bottom bar on scroll', () => {
  it('hides while scrolling down and comes back when scrolling up', () => {
    expect(nextBarsHidden(false, 300, 340, 2000)).toBe(true);
    expect(nextBarsHidden(true, 340, 320, 2000)).toBe(false);
  });

  it('ignores small jitters', () => {
    expect(nextBarsHidden(true, 500, 503, 2000)).toBe(true);
    expect(nextBarsHidden(false, 500, 497, 2000)).toBe(false);
  });

  it('always shows near the top and at the end of the page', () => {
    expect(nextBarsHidden(true, 100, 40, 2000)).toBe(false);
    expect(nextBarsHidden(false, 1990, 2000, 2000)).toBe(false);
  });
});
