import type { LyricLine } from './db.ts';

export type WhisperChunk = { timestamp: [number, number | null]; text: string };

const NOISE = /^[\s.…♪♫*-]*$|^[[(](m[uú]sica|music|aplausos|applause|instrumental|risos)[\])]$/iu;
const MAX_LINE = 60;

/** Whisper segments → lyric lines: noise dropped, long segments split at a word boundary with proportional time. */
export const transcriptToLines = (chunks: readonly WhisperChunk[]): LyricLine[] => {
  const lines: LyricLine[] = [];
  for (const chunk of chunks) {
    const text = chunk.text.replace(/\s+/gu, ' ').trim();
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
