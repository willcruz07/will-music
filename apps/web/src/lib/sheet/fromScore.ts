/**
 * The AI-made score of a song (stored notes, piano notes or drum hits on the song's tempo grid) turned into an
 * editable written score. The grid is four sixteenths per beat in 4/4, so the result is always 4/4; only the chosen
 * span of measures is converted (whole songs would be too heavy to edit on a phone).
 */
import { type ChordSegment, type DrumHit, type KeyResult, chordsToHarmony, keyFifths, type NoteEvent, tickAt, toDisplayLabel } from '@will-music/engine';
import type { ScoreRecord, Song } from '../db.ts';
import { scoreGrid } from '../score.ts';
import { createSheet, type Pitch, type Sheet, type SheetEvent, spellMidi, splitTicks } from './model.ts';
import { normalize } from './edit.ts';

export type EditableType = 'melody' | 'keys' | 'drums';
type AnalysisLike = { key: KeyResult; chords: ChordSegment[] } | undefined;
type Item = { start: number; dur: number; pitches: Pitch[]; accent: boolean };

const SIXTEENTH = 6; // model ticks per grid step
const STEPS_PER_BAR = 16;

/** Each event of a staff: notes starting together form a chord, cut where the next onset starts. */
const itemsFromNotes = (notes: readonly NoteEvent[], grid: NonNullable<ReturnType<typeof scoreGrid>>, flats: boolean, chords = true): Item[] => {
  const mean = notes.reduce((n, x) => n + x.velocity, 0) / Math.max(1, notes.length);
  const byStart = new Map<number, { end: number; pitches: number[]; velocity: number }>();
  for (const n of notes) {
    const start = tickAt(grid, n.start);
    const end = Math.max(start + 1, tickAt(grid, n.end));
    const slot = byStart.get(start);
    if (!slot) byStart.set(start, { end, pitches: [n.pitch], velocity: n.velocity });
    else if (chords && !slot.pitches.includes(n.pitch)) { slot.pitches.push(n.pitch); slot.end = Math.max(slot.end, end); slot.velocity = Math.max(slot.velocity, n.velocity); }
    else if (!chords && n.velocity > slot.velocity) byStart.set(start, { end, pitches: [n.pitch], velocity: n.velocity });
  }
  const starts = [...byStart.keys()].sort((a, b) => a - b);
  return starts.map((start, i) => {
    const slot = byStart.get(start)!;
    const end = Math.min(slot.end, starts[i + 1] ?? Infinity);
    return { start, dur: Math.max(1, end - start), pitches: slot.pitches.sort((a, b) => a - b).map((p) => spellMidi(p, flats)), accent: slot.velocity > mean * 1.3 };
  });
};

const DRUM_OF: Record<DrumHit['kind'], 'kick' | 'snare' | 'hihatClosed'> = { kick: 'kick', snare: 'snare', hihat: 'hihatClosed' };
const itemsFromHits = (hits: readonly DrumHit[], grid: NonNullable<ReturnType<typeof scoreGrid>>): Item[] => {
  const byStart = new Map<number, Set<'kick' | 'snare' | 'hihatClosed'>>();
  for (const h of hits) { const t = tickAt(grid, h.time); (byStart.get(t) ?? byStart.set(t, new Set()).get(t)!).add(DRUM_OF[h.kind]); }
  const starts = [...byStart.keys()].sort((a, b) => a - b);
  return starts.map((start, i) => ({ start, dur: Math.max(1, Math.min(4, (starts[i + 1] ?? start + 2) - start)), pitches: [...byStart.get(start)!].map((drum) => ({ drum })), accent: false }));
};

/** Items (grid steps) → complete measures of events, ties across bar lines, rests in the gaps. */
const toMeasures = (items: Item[], fromBar: number, bars: number, chordAt: Map<number, string>): SheetEvent[][] => {
  const out: SheetEvent[][] = [];
  const begin = fromBar * STEPS_PER_BAR;
  const relevant = items.filter((it) => it.start + it.dur > begin && it.start < begin + bars * STEPS_PER_BAR);
  for (let b = 0; b < bars; b++) {
    const events: SheetEvent[] = [];
    const barStart = begin + b * STEPS_PER_BAR;
    const barEnd = barStart + STEPS_PER_BAR;
    let t = barStart;
    const push = (from: number, length: number, item?: Item, tieOut = false, first = true) => {
      const parts = splitTicks(length * SIXTEENTH);
      parts.forEach((v, i) => {
        if (!item) { events.push({ kind: 'rest', duration: v.duration, dots: v.dots }); return; }
        const e: SheetEvent = { kind: 'note', duration: v.duration, dots: v.dots, pitches: structuredClone(item.pitches) };
        if (i < parts.length - 1 || tieOut) e.tieToNext = true;
        if (i === 0 && first) {
          if (item.accent) e.articulations = ['accent'];
          const chord = chordAt.get(from);
          if (chord) e.chordSymbol = chord;
        }
        events.push(e);
      });
    };
    for (const it of relevant) {
      const s = Math.max(it.start, barStart);
      const e = Math.min(it.start + it.dur, barEnd);
      if (e <= t || s >= barEnd) continue;
      const from = Math.max(s, t);
      if (from > t) push(t, from - t);
      push(from, e - from, it, it.start + it.dur > barEnd, from === it.start);
      t = e;
    }
    if (t < barEnd) push(t, barEnd - t);
    out.push(events);
  }
  return out;
};

const lastStep = (items: Item[]) => items.reduce((n, it) => Math.max(n, it.start + it.dur), 0);

/** Suggested span (1-based measures): from the first measure with notes, up to 32 measures. */
export const suggestedRange = (type: EditableType, analysis: AnalysisLike, score: ScoreRecord | undefined): { from: number; to: number; total: number } | null => {
  const items = itemsFor(type, analysis, score);
  if (!items?.length) return null;
  const first = Math.floor(items[0]!.start / STEPS_PER_BAR) + 1;
  const total = Math.ceil(lastStep(items) / STEPS_PER_BAR);
  return { from: first, to: Math.min(total, first + 31), total };
};

const itemsFor = (type: EditableType, analysis: AnalysisLike, score: ScoreRecord | undefined): Item[] | null => {
  const grid = score ? scoreGrid(type, analysis, score) : null;
  if (!score || !grid) return null;
  const flats = keyFifths(analysis?.key) < 0;
  if (type === 'melody') return itemsFromNotes(score.notes, grid, flats, false);
  if (type === 'keys') return score.piano ? itemsFromNotes(score.piano.notes, grid, flats) : null;
  return score.drums ? itemsFromHits(score.drums.hits, grid) : null;
};

export const scoreToSheet = (type: EditableType, song: Pick<Song, 'id' | 'title' | 'artist'>, analysis: AnalysisLike, score: ScoreRecord, range: { from: number; to: number }, author: string): Sheet => {
  const grid = scoreGrid(type, analysis, score);
  const items = itemsFor(type, analysis, score);
  if (!grid || !items?.length) throw new Error('Esta parte ainda não tem notas para editar.');
  const fromBar = Math.max(0, range.from - 1);
  const bars = Math.max(1, Math.min(200, range.to - range.from + 1));
  const chordAt = new Map<number, string>();
  if (type !== 'drums') for (const h of chordsToHarmony(analysis?.chords ?? [], grid)) chordAt.set(h.tick, toDisplayLabel(h.raw));
  const staffType = type === 'keys' ? 'piano' : type === 'drums' ? 'drums' : 'single';
  const label = type === 'keys' ? 'teclado' : type === 'drums' ? 'bateria' : 'melodia';
  const sheet = createSheet({
    title: `${song.title} (${label}, compassos ${range.from}–${range.from + bars - 1})`, author, staffType, sound: type === 'drums' ? 'drums' : type === 'keys' ? 'piano' : 'melody',
    keyFifths: keyFifths(analysis?.key), timeSignature: { beats: 4, unit: 4 }, tempo: Math.round(grid.bpm), measures: bars, songId: song.id,
  });
  if (type === 'keys') {
    // Split by register: from middle C up to the right hand, below to the left.
    const right = items.map((it) => ({ ...it, pitches: it.pitches.filter((p) => 'step' in p && (p.octave + 1) * 12 >= 60) })).filter((it) => it.pitches.length);
    const left = items.map((it) => ({ ...it, pitches: it.pitches.filter((p) => 'step' in p && (p.octave + 1) * 12 < 60) })).filter((it) => it.pitches.length);
    const rightBars = toMeasures(right, fromBar, bars, chordAt);
    const leftBars = toMeasures(left, fromBar, bars, new Map());
    sheet.staves[0]!.measures = rightBars.map((events) => ({ events }));
    sheet.staves[1]!.measures = leftBars.map((events) => ({ events }));
  } else {
    sheet.staves[0]!.measures = toMeasures(items, fromBar, bars, chordAt).map((events) => ({ events }));
  }
  return normalize(sheet);
};
