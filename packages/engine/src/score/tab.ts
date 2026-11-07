/** Standard tuning, string 1 (high E) to string 6 (low E), as MIDI numbers. */
export const STANDARD_TUNING = [64, 59, 55, 50, 45, 40] as const;
const MAX_FRET = 15;

export type FretPosition = { string: number; fret: number; pitch: number };

/** Moves a pitch by octaves until the guitar can play it. */
const fitRange = (pitch: number, tuning: readonly number[]): number => {
  const low = Math.min(...tuning);
  const high = Math.max(...tuning) + MAX_FRET;
  let p = pitch;
  while (p < low) p += 12;
  while (p > high) p -= 12;
  return p;
};

/**
 * Chooses a string and fret for each melody note, minimising hand movement (dynamic programming over
 * every playable position), with a small cost for high frets and for jumping across strings.
 */
export const assignFrets = (pitches: readonly number[], tuning: readonly number[] = STANDARD_TUNING): FretPosition[] => {
  if (!pitches.length) return [];
  const options = pitches.map((raw) => {
    const pitch = fitRange(raw, tuning);
    const list: FretPosition[] = [];
    tuning.forEach((open, i) => {
      const fret = pitch - open;
      if (fret >= 0 && fret <= MAX_FRET) list.push({ string: i + 1, fret, pitch });
    });
    return list;
  });
  const own = (o: FretPosition) => o.fret * 0.08;
  const move = (a: FretPosition, b: FretPosition) =>
    (a.fret === 0 || b.fret === 0 ? 0.5 : Math.abs(a.fret - b.fret)) + 0.15 * Math.abs(a.string - b.string);
  let cost = options[0]!.map(own);
  const back: number[][] = [];
  for (let i = 1; i < options.length; i++) {
    const prev = options[i - 1]!;
    const next: number[] = [];
    const from: number[] = [];
    for (const o of options[i]!) {
      let best = Number.POSITIVE_INFINITY;
      let arg = 0;
      prev.forEach((p, j) => {
        const c = cost[j]! + move(p, o);
        if (c < best) {
          best = c;
          arg = j;
        }
      });
      next.push(best + own(o));
      from.push(arg);
    }
    cost = next;
    back.push(from);
  }
  let j = cost.indexOf(Math.min(...cost));
  const out: FretPosition[] = new Array(pitches.length);
  for (let i = options.length - 1; i >= 0; i--) {
    out[i] = options[i]![j]!;
    if (i > 0) j = back[i - 1]![j]!;
  }
  return out;
};
