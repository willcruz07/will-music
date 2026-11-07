import { parseChordPro } from './chart.ts';

const LINE_SEC = 4;

/** Text of every lyric line (chords removed, spaces collapsed), in chart order. */
export const lyricTexts = (chordPro: string): string[] =>
  parseChordPro(chordPro)
    .lines.filter((l) => l.kind === 'lyric')
    .map((l) => (l.kind === 'lyric' ? l.parts.map((p) => p.text).join('').replace(/\s+/gu, ' ').trim() : ''));

/**
 * Carries line times across an edit: lines matched by LCS keep their time; inside a changed block
 * of equal size times stay by position; otherwise the first new line keeps the block's first time
 * and the rest become null (to be interpolated).
 */
export const remapLineTimes = (oldChordPro: string, newChordPro: string, oldTimes: readonly (number | null)[]): (number | null)[] => {
  const a = lyricTexts(oldChordPro);
  const b = lyricTexts(newChordPro);
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: (number | null)[] = [];
  const flush = (oldBlock: number[], newCount: number) => {
    if (newCount === 0) return;
    if (oldBlock.length === newCount) for (const i of oldBlock) out.push(oldTimes[i] ?? null);
    else for (let k = 0; k < newCount; k++) out.push(k === 0 && oldBlock.length ? (oldTimes[oldBlock[0]!] ?? null) : null);
  };
  let i = 0;
  let j = 0;
  let oldBlock: number[] = [];
  let newCount = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush(oldBlock, newCount);
      oldBlock = [];
      newCount = 0;
      out.push(oldTimes[i] ?? null);
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      newCount++;
      j++;
    } else {
      oldBlock.push(i);
      i++;
    }
  }
  flush(oldBlock, newCount);
  return out;
};

/** Fills null times by linear interpolation; ends are extrapolated by 4 s per line; result never decreases. */
export const resolveLineTimes = (times: readonly (number | null)[]): number[] => {
  const known = times.flatMap((t, i) => (t === null ? [] : [i]));
  if (known.length === 0) return times.map((_, i) => i * LINE_SEC);
  const out = times.map((t, i) => {
    if (t !== null) return t;
    const prev = [...known].reverse().find((k) => k < i);
    const next = known.find((k) => k > i);
    if (prev !== undefined && next !== undefined) {
      const a = times[prev]!;
      const b = times[next]!;
      return a + ((b - a) * (i - prev)) / (next - prev);
    }
    if (prev !== undefined) return times[prev]! + (i - prev) * LINE_SEC;
    return Math.max(0, times[next!]! - (next! - i) * LINE_SEC);
  });
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i]!, out[i - 1]!);
  return out;
};

/** Start time of every lyric line of a chart; charts saved before lineTimes existed fall back to the analysis lyrics. */
export const chartLineStarts = (
  chart: { chordPro: string; lineTimes?: (number | null)[] } | undefined,
  lyricLines: readonly { start: number; text?: string }[] | undefined,
): number[] => {
  if (!chart) return [];
  const count = lyricTexts(chart.chordPro).length;
  const times = chart.lineTimes ?? lyricLines?.map((l) => l.start) ?? [];
  const padded = Array.from({ length: count }, (_, i) => times[i] ?? null);
  return count ? resolveLineTimes(padded) : [];
};
