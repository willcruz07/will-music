import type { LyricLine } from './db.ts';

export type WhisperChunk = { timestamp: [number, number | null]; text: string };

const NOISE = /^[\s.…♪♫*-]*$|^[[(](m[uú]sica|music|aplausos|applause|instrumental|risos)[\])]$/iu;
const MAX_LINE = 60;
const MAX_REPEATS = 2;
const LOOP_MIN_WORDS = 12;

const wordKey = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Collapses a phrase repeated back to back to at most two copies ("santo santo santo santo" → "santo santo"). */
const collapseRepeats = (words: readonly string[]): string[] => {
  let out = [...words];
  for (let n = 1; n <= 8; n++) {
    const keys = out.map(wordKey);
    const kept: string[] = [];
    let i = 0;
    while (i < out.length) {
      let copies = 1;
      while (i + (copies + 1) * n <= out.length && keys.slice(i, i + n).every((k, j) => k === keys[i + copies * n + j])) copies++;
      if (copies > MAX_REPEATS) {
        kept.push(...out.slice(i, i + MAX_REPEATS * n));
        i += copies * n;
      } else {
        kept.push(out[i]!);
        i++;
      }
    }
    out = kept;
  }
  return out;
};

/**
 * Whisper sometimes gets stuck repeating a phrase for a whole 30 s window ("o que é o que é o que é…"), mostly over
 * instrumental parts. A segment that is mostly one loop is dropped; a short stutter is collapsed to two copies.
 */
const cleanLoops = (text: string): string => {
  const words = text.split(' ');
  const kept = collapseRepeats(words);
  if (words.length >= LOOP_MIN_WORDS && kept.length / words.length < 0.5) return '';
  return kept.join(' ');
};

/** Whisper segments → lyric lines: noise dropped, long segments split at a word boundary with proportional time. */
export const transcriptToLines = (chunks: readonly WhisperChunk[]): LyricLine[] => {
  const lines: LyricLine[] = [];
  for (const chunk of chunks) {
    const text = cleanLoops(chunk.text.replace(/\s+/gu, ' ').trim());
    if (!text || NOISE.test(text)) continue;
    const [start, end] = chunk.timestamp;
    if (text.length <= MAX_LINE) {
      lines.push({ start, text });
      continue;
    }
    const middle = text.length / 2;
    let cut = text.lastIndexOf(' ', Math.ceil(middle));
    if (cut <= 0) cut = text.indexOf(' ', Math.floor(middle));
    if (cut <= 0) {
      lines.push({ start, text });
      continue;
    }
    const first = text.slice(0, cut).trim();
    const second = text.slice(cut).trim();
    const span = (end ?? start + 4) - start;
    lines.push({ start, text: first }, { start: Math.round((start + span * (cut / text.length)) * 100) / 100, text: second });
  }
  return lines;
};

/** Needs 3+ distinct lines with letters, mostly not repeats (Whisper repeats phrases like "Obrigado." over instrumentals). */
export const isUsefulTranscript = (lines: readonly LyricLine[]): boolean => {
  const texts = lines.map((l) => l.text.toLowerCase().replace(/[^\p{L}\s]/gu, '').trim()).filter(Boolean);
  const distinct = new Set(texts);
  return distinct.size >= 3 && distinct.size / texts.length >= 0.5;
};

/**
 * Seconds of silence before the voice starts (minus a half-second margin), so Whisper does not hallucinate over a
 * silent intro of the vocal track. Zero when there is sound right away or no sound at all.
 */
export const leadingSilence = (audio: Float32Array, rate: number): number => {
  const window = Math.round(rate / 10);
  for (let start = 0; start + window <= audio.length; start += window) {
    let sum = 0;
    for (let i = start; i < start + window; i++) sum += audio[i]! * audio[i]!;
    if (Math.sqrt(sum / window) >= 0.01) return Math.max(0, start / rate - 0.5);
  }
  return 0;
};

const PAUSE_SEC = 0.5;
const WORD_LINE = 45;

/**
 * Whisper word timestamps → line-sized segments. Each line starts at the moment its first word is sung, which is
 * what the follow highlight needs; segment-level timestamps start in the silence before a phrase or cover two.
 * Lines break on a pause, after sentence punctuation, or before getting too long to read.
 */
export const wordsToSegments = (words: readonly WhisperChunk[]): WhisperChunk[] => {
  const out: WhisperChunk[] = [];
  let text = '';
  let start = 0;
  let end: number | null = null;
  const flush = () => {
    if (text) out.push({ timestamp: [start, end], text });
    text = '';
  };
  for (const word of words) {
    const t = word.text.trim();
    if (!t) continue;
    const [wStart, wEnd] = word.timestamp;
    const paused = end !== null && wStart - end >= PAUSE_SEC;
    if (text && (paused || /[.!?…]$/u.test(text) || text.length + 1 + t.length > WORD_LINE)) flush();
    if (!text) start = wStart;
    text = text ? `${text} ${t}` : t;
    end = wEnd;
  }
  flush();
  return out;
};

