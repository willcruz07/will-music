import { describe, expect, it } from 'vitest';
import { formatClock, scoreWholeAt, secondsAtWhole, stepAt } from '../src/lib/scorePlayback.ts';

// 120 BPM: a beat is 0.5 s, a 16th (tick) 0.125 s, a 4/4 bar 2 s.
const grid = { bpm: 120, origin: -0.25, tick: 0.125 };

describe('score playback position', () => {
  it('maps song time to whole notes on the drawn score, counting the dropped bars', () => {
    expect(scoreWholeAt(-0.25, grid, 0)).toBe(0);
    expect(scoreWholeAt(1.75, grid, 0)).toBe(1);
    // Two empty bars (32 ticks) were dropped: the first drawn bar starts 4 s later.
    expect(scoreWholeAt(3.75, grid, 32)).toBe(0);
    expect(scoreWholeAt(4.75, grid, 32)).toBe(0.5);
  });

  it('goes back from the score to song time', () => {
    expect(secondsAtWhole(0.5, grid, 32)).toBeCloseTo(4.75);
    expect(secondsAtWhole(scoreWholeAt(10, grid, 16), grid, 16)).toBeCloseTo(10);
  });

  it('finds the step sounding now', () => {
    const steps = [0, 0.25, 0.5, 1, 1.25];
    expect(stepAt(steps, -0.1)).toBe(-1);
    expect(stepAt(steps, 0)).toBe(0);
    expect(stepAt(steps, 0.4)).toBe(1);
    expect(stepAt(steps, 0.5)).toBe(2);
    expect(stepAt(steps, 9)).toBe(4);
  });

  it('formats the clock', () => {
    expect(formatClock(5.9)).toBe('0:05');
    expect(formatClock(65)).toBe('1:05');
  });
});
