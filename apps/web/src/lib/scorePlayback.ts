import { type Grid, TICKS_PER_BAR } from '@will-music/engine';

/** Where song time lands on the written score, in whole notes from the first drawn bar (4/4: a bar is one whole). */
export const scoreWholeAt = (seconds: number, grid: Grid, skipTicks: number): number =>
  ((seconds - grid.origin) / grid.tick - skipTicks) / TICKS_PER_BAR;

/** Song time of a spot on the written score (inverse of scoreWholeAt). */
export const secondsAtWhole = (whole: number, grid: Grid, skipTicks: number): number =>
  grid.origin + (whole * TICKS_PER_BAR + skipTicks) * grid.tick;

/**
 * Index of the cursor step that is sounding at `whole`: the last step starting at or before it (steps sorted by
 * start). -1 before the first step.
 */
export const stepAt = (steps: readonly number[], whole: number): number => {
  let lo = 0;
  let hi = steps.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (steps[mid]! <= whole + 1e-6) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

/** "1:05" style clock. */
export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
