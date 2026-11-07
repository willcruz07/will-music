import type { KeyResult } from '../key/key.ts';
import { type Harmony, type QNote, TICKS_PER_BAR } from './quantize.ts';
import { STANDARD_TUNING, assignFrets } from './tab.ts';

export type LeadSheetInput = {
  title: string;
  artist: string;
  bpm: number;
  key?: KeyResult;
  notes: readonly QNote[];
  harmonies: readonly Harmony[];
  /** Adds a guitar tablature part under the melody. */
  tab: boolean;
};

const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const MAJOR_FIFTHS = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];
const SHARPS: [string, number][] = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const FLATS: [string, number][] = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];

const KINDS: Record<string, string> = {
  maj: 'major', min: 'minor', dim: 'diminished', aug: 'augmented', min6: 'minor-sixth', maj6: 'major-sixth',
  min7: 'minor-seventh', minmaj7: 'major-minor', maj7: 'major-seventh', '7': 'dominant', dim7: 'diminished-seventh',
  hdim7: 'half-diminished', sus2: 'suspended-second', sus4: 'suspended-fourth',
};

/** Fifths of the key signature; minor keys use their relative major. */
export const keyFifths = (key: KeyResult | undefined): number => {
  const pc = key ? PC[key.root] : undefined;
  if (key === undefined || pc === undefined) return 0;
  return MAJOR_FIFTHS[key.mode === 'minor' ? (pc + 3) % 12 : pc]!;
};

export const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const spell = (pc: number, flats: boolean) => (flats ? FLATS : SHARPS)[((pc % 12) + 12) % 12]!;
export const alterXml = (alter: number, tag: string) => (alter ? `<${tag}>${alter}</${tag}>` : '');

const DURATIONS: [number, string, boolean][] = [[16, 'whole', false], [12, 'half', true], [8, 'half', false], [6, 'quarter', true], [4, 'quarter', false], [3, 'eighth', true], [2, 'eighth', false], [1, '16th', false]];

/** Splits a duration into writable values (largest first). */
const splitDuration = (ticks: number): [number, string, boolean][] => {
  const out: [number, string, boolean][] = [];
  let left = ticks;
  while (left > 0) {
    const d = DURATIONS.find(([v]) => v <= left)!;
    out.push(d);
    left -= d[0];
  }
  return out;
};

export type Piece = { start: number; dur: number; type: string; dot: boolean; note?: number; tieStart: boolean; tieStop: boolean };

/** Notes and rests cut at bar lines and chord changes, then into writable values, with ties where a note is split. */
export const timeline = (notes: readonly { start: number; dur: number }[], cuts: Set<number>, total: number): Piece[] => {
  const spans: { start: number; end: number; note?: number }[] = [];
  let at = 0;
  notes.forEach((n, i) => {
    if (n.start > at) spans.push({ start: at, end: n.start });
    spans.push({ start: n.start, end: n.start + n.dur, note: i });
    at = n.start + n.dur;
  });
  if (at < total) spans.push({ start: at, end: total });
  const pieces: Piece[] = [];
  for (const span of spans) {
    const bounds = [span.start, ...[...cuts].filter((c) => c > span.start && c < span.end).sort((a, z) => a - z), span.end];
    const parts: Piece[] = [];
    for (let b = 0; b < bounds.length - 1; b++) {
      let s = bounds[b]!;
      for (const [dur, type, dot] of splitDuration(bounds[b + 1]! - s)) {
        parts.push({ start: s, dur, type, dot, note: span.note, tieStart: false, tieStop: false });
        s += dur;
      }
    }
    if (span.note !== undefined) parts.forEach((p, k) => Object.assign(p, { tieStop: k > 0, tieStart: k < parts.length - 1 }));
    pieces.push(...parts);
  }
  return pieces;
};

export const pitchXml = (midi: number, flats: boolean) => {
  const [step, alter] = spell(midi, flats);
  return `<pitch><step>${step}</step>${alterXml(alter, 'alter')}<octave>${Math.floor(midi / 12) - 1}</octave></pitch>`;
};

export const harmonyXml = (raw: string, flats: boolean) => {
  const [root = 'C', quality = 'maj'] = raw.split(':');
  const [step, alter] = spell(PC[root] ?? 0, flats);
  return `<harmony><root><root-step>${step}</root-step>${alterXml(alter, 'root-alter')}</root><kind>${KINDS[quality] ?? 'major'}</kind></harmony>`;
};

const noteXml = (p: Piece, pitch: number | undefined, flats: boolean, technical = '') => {
  if (pitch === undefined) return `<note><rest/><duration>${p.dur}</duration><voice>1</voice><type>${p.type}</type>${p.dot ? '<dot/>' : ''}</note>`;
  const ties = `${p.tieStop ? '<tie type="stop"/>' : ''}${p.tieStart ? '<tie type="start"/>' : ''}`;
  const tied = `${p.tieStop ? '<tied type="stop"/>' : ''}${p.tieStart ? '<tied type="start"/>' : ''}`;
  const notations = tied || technical ? `<notations>${tied}${technical}</notations>` : '';
  return `<note>${pitchXml(pitch, flats)}<duration>${p.dur}</duration>${ties}<voice>1</voice><type>${p.type}</type>${p.dot ? '<dot/>' : ''}${notations}</note>`;
};

/** Builds a MusicXML 4.0 lead sheet (melody + chord symbols), optionally with a guitar tablature part. */
export const buildMusicXml = (raw: LeadSheetInput): string => {
  // Leading bars with neither notes nor chords are silence before the music: drop them.
  const firstTick = Math.min(Number.POSITIVE_INFINITY, ...raw.notes.map((n) => n.start), ...raw.harmonies.map((h) => h.tick));
  const skip = Number.isFinite(firstTick) ? Math.floor(firstTick / TICKS_PER_BAR) * TICKS_PER_BAR : 0;
  const input: LeadSheetInput = {
    ...raw,
    notes: raw.notes.map((n) => ({ ...n, start: n.start - skip })),
    harmonies: raw.harmonies.map((h) => ({ ...h, tick: h.tick - skip })),
  };
  const fifths = keyFifths(input.key);
  const flats = fifths < 0;
  const end = Math.max(1, ...input.notes.map((n) => n.start + n.dur), ...input.harmonies.map((h) => h.tick + 1));
  const bars = Math.ceil(end / TICKS_PER_BAR);
  const total = bars * TICKS_PER_BAR;
  const cuts = new Set<number>([...Array.from({ length: bars }, (_, i) => i * TICKS_PER_BAR), ...input.harmonies.map((h) => h.tick)]);
  const pieces = timeline(input.notes, cuts, total);
  const harmonyAt = new Map(input.harmonies.map((h) => [h.tick, h.raw]));
  const frets = input.tab ? assignFrets(input.notes.map((n) => n.pitch)) : [];
  const keyXml = `<key><fifths>${fifths}</fifths><mode>${input.key?.mode ?? 'major'}</mode></key><time><beats>4</beats><beat-type>4</beat-type></time>`;
  const tempo = `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${input.bpm}</per-minute></metronome></direction-type><sound tempo="${input.bpm}"/></direction>`;
  const tuning = [...STANDARD_TUNING].reverse().map((midi, i) => {
    const [step, alter] = spell(midi, false);
    return `<staff-tuning line="${i + 1}"><tuning-step>${step}</tuning-step>${alterXml(alter, 'tuning-alter')}<tuning-octave>${Math.floor(midi / 12) - 1}</tuning-octave></staff-tuning>`;
  });

  const part = (id: string, tab: boolean) => {
    let xml = `<part id="${id}">`;
    for (let bar = 0; bar < bars; bar++) {
      const from = bar * TICKS_PER_BAR;
      const inBar = pieces.filter((p) => p.start >= from && p.start < from + TICKS_PER_BAR);
      xml += `<measure number="${bar + 1}">`;
      if (bar === 0) {
        xml += tab
          ? `<attributes><divisions>4</divisions>${keyXml}<clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines>${tuning.join('')}</staff-details></attributes>`
          : `<attributes><divisions>4</divisions>${keyXml}<clef><sign>G</sign><line>2</line></clef></attributes>${tempo}`;
      }
      const emptyBar = inBar.length > 0 && inBar.every((p) => p.note === undefined) && !inBar.some((p) => harmonyAt.has(p.start) && !tab);
      if (emptyBar) xml += `<note><rest measure="yes"/><duration>${TICKS_PER_BAR}</duration><voice>1</voice></note>`;
      else {
        for (const p of inBar) {
          if (!tab && harmonyAt.has(p.start)) xml += harmonyXml(harmonyAt.get(p.start)!, flats);
          if (p.note === undefined) xml += noteXml(p, undefined, flats);
          else if (tab) {
            const f = frets[p.note]!;
            xml += noteXml(p, f.pitch, flats, `<technical><string>${f.string}</string><fret>${f.fret}</fret></technical>`);
          } else xml += noteXml(p, input.notes[p.note]!.pitch, flats);
        }
      }
      xml += '</measure>';
    }
    return `${xml}</part>`;
  };

  const parts = [`<score-part id="P1"><part-name>Melodia</part-name></score-part>`];
  if (input.tab) parts.push(`<score-part id="P2"><part-name>Violão</part-name></score-part>`);
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    `<score-partwise version="4.0"><work><work-title>${escape(input.title)}</work-title></work>`,
    `<identification><creator type="composer">${escape(input.artist)}</creator><encoding><software>will-music</software></encoding></identification>`,
    `<part-list>${parts.join('')}</part-list>`,
    part('P1', false),
    input.tab ? part('P2', true) : '',
    '</score-partwise>',
  ].join('\n');
};
