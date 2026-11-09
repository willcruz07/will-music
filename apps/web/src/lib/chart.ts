import { type ChordSegment, type KeyResult, toDisplayLabel } from '@will-music/engine';
import type { LyricLine } from './db.ts';

// Preserve passing chords lasting at least ~3 model frames; the decoder handles unstable predictions.
const MIN_CHORD_SEC = 0.25;
const MAX_LINE_SEC = 8;
const CHORDS_PER_ROW = 4;

export const keyToChord = (key: Pick<KeyResult, 'root' | 'mode'>): string => `${key.root}${key.mode === 'minor' ? 'm' : ''}`;

type Chord = { start: number; end: number; label: string };

const cleanChords = (segments: readonly ChordSegment[]): Chord[] => {
  const out: Chord[] = [];
  for (const s of segments) {
    if (s.end - s.start < MIN_CHORD_SEC || s.raw === 'N' || s.raw === 'X') continue;
    const label = toDisplayLabel(s.raw);
    const last = out.at(-1);
    if (last && last.label === label) last.end = s.end;
    else out.push({ start: s.start, end: s.end, label });
  }
  return out;
};

const chordRows = (chords: Chord[]): string[] => {
  const rows: string[] = [];
  for (let i = 0; i < chords.length; i += CHORDS_PER_ROW) rows.push(chords.slice(i, i + CHORDS_PER_ROW).map((c) => `[${c.label}]`).join(' '));
  return rows;
};

const wordStarts = (text: string): number[] => {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i++) if (text[i] !== ' ' && (i === 0 || text[i - 1] === ' ')) starts.push(i);
  return starts.length ? starts : [0];
};

// Square brackets in lyrics ("[Refrão]") would be read as chords; show them as parentheses.
const escapeLyric = (text: string): string => text.replace(/\[/gu, '(').replace(/\]/gu, ')');

/** Chords go left to right in time order on word starts; chords that find no free word are appended after the text. */
const placeChords = (rawText: string, start: number, end: number, chords: Chord[], active?: Chord): string => {
  const text = escapeLyric(rawText);
  const starts = wordStarts(text);
  const span = Math.max(0.001, end - start);
  const queue = [
    ...(active ? [{ label: active.label, target: Number.NEGATIVE_INFINITY }] : []),
    ...[...chords].sort((a, b) => a.start - b.start).map((c) => ({ label: c.label, target: ((c.start - start) / span) * text.length })),
  ];
  const used = new Map<number, string>();
  const extras: string[] = [];
  let last = -1;
  for (const chord of queue) {
    const candidates = starts.filter((p) => p > last);
    if (candidates.length === 0) {
      extras.push(chord.label);
      continue;
    }
    const position = candidates.reduce((best, p) => (Math.abs(p - chord.target) < Math.abs(best - chord.target) ? p : best));
    used.set(position, chord.label);
    last = position;
  }
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const label = used.get(i);
    if (label) out += `[${label}]`;
    out += text[i];
  }
  return extras.length ? `${out} ${extras.map((l) => `[${l}]`).join(' ')}` : out;
};

export const buildChart = (input: { title: string; artist: string; key: KeyResult; chords: ChordSegment[]; lines: LyricLine[] }): string => {
  const chords = cleanChords(input.chords);
  const lines = [...input.lines].sort((a, b) => a.start - b.start);
  const out = [`{title: ${input.title}}`];
  if (input.artist) out.push(`{artist: ${input.artist}}`);
  out.push(`{key: ${keyToChord(input.key)}}`, '');
  if (lines.length === 0) {
    out.push(...chordRows(chords));
    return `${out.join('\n')}\n`;
  }
  const between = (from: number, to: number) => chords.filter((c) => c.start >= from && c.start < to);
  const intro = between(Number.NEGATIVE_INFINITY, lines[0]!.start);
  if (intro.length) out.push('{comment: Intro}', ...chordRows(intro), '');
  lines.forEach((line, i) => {
    const next = lines[i + 1]?.start ?? Number.POSITIVE_INFINITY;
    const lineEnd = Math.min(next, line.start + MAX_LINE_SEC);
    const inside = between(line.start, lineEnd);
    const active = chords.find((c) => c.start < line.start && c.end > line.start);
    out.push(placeChords(line.text, line.start, lineEnd, inside, inside[0] && inside[0].start - line.start < 0.3 ? undefined : active));
    const gap = between(lineEnd, next);
    if (gap.length) out.push('', `{comment: ${Number.isFinite(next) ? 'Instrumental' : 'Final'}}`, ...chordRows(gap), '');
  });
  return `${out.join('\n')}\n`;
};

export type ChartLine =
  | { kind: 'lyric'; parts: { chord?: string; text: string }[] }
  | { kind: 'comment'; text: string }
  | { kind: 'chords'; chords: string[] };

export const parseChordPro = (text: string): { meta: Record<string, string>; lines: ChartLine[] } => {
  const meta: Record<string, string> = {};
  const lines: ChartLine[] = [];
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const directive = /^\{\s*([a-z_]+)\s*:?\s*(.*?)\s*\}$/iu.exec(line.trim());
    if (directive) {
      const name = directive[1]!.toLowerCase();
      if (name === 'comment' || name === 'c') lines.push({ kind: 'comment', text: directive[2]! });
      else meta[name] = directive[2]!;
      continue;
    }
    if (/^(\s*\[[^\]]+\]\s*)+$/u.test(line)) {
      lines.push({ kind: 'chords', chords: [...line.matchAll(/\[([^\]]+)\]/gu)].map((m) => m[1]!) });
      continue;
    }
    const parts: { chord?: string; text: string }[] = [];
    const pieces = line.split(/\[([^\]]+)\]/u);
    if (pieces[0]) parts.push({ text: pieces[0] });
    for (let i = 1; i < pieces.length; i += 2) parts.push({ chord: pieces[i]!, text: pieces[i + 1] ?? '' });
    lines.push({ kind: 'lyric', parts });
  }
  return { meta, lines };
};
