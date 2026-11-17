import type { LyricLine } from './db.ts';

/** One word Whisper heard, with the time it starts (seconds). */
export type TimedWord = { start: number; text: string };

const fold = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const tokens = (s: string): string[] => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Levenshtein distance, stopping early once it passes `max`. */
const distance = (a: string, b: string, max: number): number => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, row[j]!);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length]!;
};
/** Same word, allowing Whisper's small misspellings on longer words. */
const similar = (a: string, b: string): boolean => {
  if (a === b) return true;
  const longest = Math.max(a.length, b.length);
  if (longest < 4) return false;
  return distance(a, b, longest >= 7 ? 2 : 1) <= (longest >= 7 ? 2 : 1);
};

export type AlignedLyrics = { lines: LyricLine[]; coverage: number };

/**
 * Puts the lyric text from LRCLIB (correct words) on the times Whisper heard (each line where its first word is
 * sung), the approach StemTube uses. The words are matched in order (longest common subsequence with tolerant word
 * comparison). Lines with no matched word take LRCLIB's own time shifted by the typical offset, or are interpolated.
 * `coverage` is the share of lyric words matched; a low value means the two texts do not agree.
 */
export const alignLyricsToWords = (lyrics: readonly LyricLine[], words: readonly TimedWord[], durationSec: number): AlignedLyrics => {
  const lyricTokens: { line: number; word: string }[] = [];
  lyrics.forEach((line, index) => { for (const word of tokens(line.text)) lyricTokens.push({ line: index, word }); });
  const heard: { start: number; word: string }[] = [];
  for (const w of words) for (const word of tokens(w.text)) heard.push({ start: w.start, word });
  const n = lyricTokens.length;
  const m = heard.length;
  if (!n || !m) return { lines: [...lyrics], coverage: 0 };

  // LCS table, kept as rows of 16-bit counts (lyrics rarely pass a few thousand words).
  const table: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 1; i <= n; i++) {
    const row = table[i]!; const up = table[i - 1]!; const word = lyricTokens[i - 1]!.word;
    for (let j = 1; j <= m; j++) row[j] = similar(word, heard[j - 1]!.word) ? up[j - 1]! + 1 : Math.max(up[j]!, row[j - 1]!);
  }
  const firstMatch = new Map<number, number>();
  let matched = 0;
  for (let i = n, j = m; i > 0 && j > 0;) {
    if (similar(lyricTokens[i - 1]!.word, heard[j - 1]!.word) && table[i]![j] === table[i - 1]![j - 1]! + 1) {
      firstMatch.set(lyricTokens[i - 1]!.line, heard[j - 1]!.start);
      matched++; i--; j--;
    } else if (table[i - 1]![j]! >= table[i]![j - 1]!) i--;
    else j--;
  }

  // Typical gap between LRCLIB's times and what was heard, for lines Whisper missed.
  const offsets = [...firstMatch].map(([line, start]) => start - lyrics[line]!.start).sort((a, b) => a - b);
  const offset = offsets.length ? offsets[Math.floor(offsets.length / 2)]! : 0;
  const hasOwnTimes = lyrics.some((line, i) => i > 0 && line.start !== lyrics[0]!.start);
  const starts: (number | null)[] = lyrics.map((line, i) => firstMatch.get(i) ?? (hasOwnTimes ? line.start + offset : null));
  // Fill gaps by interpolation and keep times in order.
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] !== null) continue;
    let next = i + 1; while (next < starts.length && starts[next] === null) next++;
    const before = i > 0 ? starts[i - 1]! : 0;
    const after = next < starts.length ? starts[next]! : durationSec;
    for (let k = i; k < next; k++) starts[k] = before + ((after - before) * (k - i + 1)) / (next - i + 1);
    i = next - 1;
  }
  let last = 0;
  const lines = lyrics.map((line, i) => {
    last = Math.max(last, Math.min(durationSec || Infinity, Math.max(0, starts[i]!)));
    return { start: Math.round(last * 100) / 100, text: line.text };
  });
  return { lines, coverage: matched / n };
};
