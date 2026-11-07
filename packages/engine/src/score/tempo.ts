const RATE = 100; // pulse-train resolution, frames per second

/**
 * Estimates the tempo from note onsets: autocorrelation of a smoothed pulse train between 70 and 160 BPM,
 * with a mild preference for tempos near 110 so a half/double-time ambiguity resolves to the common case.
 */
export const estimateTempo = (onsets: readonly number[]): number => {
  if (onsets.length < 4) return 100;
  const length = Math.ceil(Math.max(...onsets) * RATE) + 4;
  const pulses = new Float32Array(length);
  for (const t of onsets) {
    const i = Math.round(t * RATE);
    for (let d = -2; d <= 2; d++) if (i + d >= 0 && i + d < length) pulses[i + d]! += Math.exp(-(d * d) / 2);
  }
  const ac = (lag: number) => {
    let sum = 0;
    for (let i = 0; i + lag < length; i++) sum += pulses[i]! * pulses[i + lag]!;
    return sum;
  };
  let best = 100;
  let bestScore = -1;
  for (let lag = Math.round((60 * RATE) / 160); lag <= Math.round((60 * RATE) / 70); lag++) {
    const bpm = (60 * RATE) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.6) ** 2);
    const score = (ac(lag) + 0.5 * ac(2 * lag)) * prior;
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  return Math.round(best);
};
