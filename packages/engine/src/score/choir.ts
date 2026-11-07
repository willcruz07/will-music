import type { KeyResult } from '../key/key.ts';
import { type Piece, escape, harmonyXml, keyFifths, pitchXml, timeline } from './musicxml.ts';
import type { NoteEvent } from './notes.ts';
import { type Harmony, type QNote, TICKS_PER_BAR } from './quantize.ts';

export type VoicePart = 'S' | 'A' | 'T' | 'B';
export const VOICE_PARTS: readonly VoicePart[] = ['S', 'A', 'T', 'B'];
export const PART_NAMES: Record<VoicePart, string> = { S: 'Soprano', A: 'Contralto', T: 'Tenor', B: 'Baixo' };

/** Usual choir ranges (MIDI) and where each voice tends to sit. */
const RANGE: Record<VoicePart, { low: number; high: number; center: number }> = {
  S: { low: 60, high: 81, center: 70 },
  A: { low: 53, high: 74, center: 63 },
  T: { low: 48, high: 69, center: 57 },
  B: { low: 40, high: 62, center: 50 },
};

const combos = (k: number): VoicePart[][] => {
  const out: VoicePart[][] = [];
  const walk = (from: number, acc: VoicePart[]) => {
    if (acc.length === k) return void out.push(acc);
    for (let i = from; i < VOICE_PARTS.length; i++) walk(i + 1, [...acc, VOICE_PARTS[i]!]);
  };
  walk(0, []);
  return out;
};

/**
 * Splits the notes heard in the voices into soprano, alto, tenor and bass. Notes that start together are
 * sorted from top to bottom and given to voices in that order (voices never cross); among the possible
 * choices, the one closest to where each voice was singing (and inside its usual range) wins.
 * Each voice stays monophonic. A draft from the sound, to be checked by ear.
 */
export const splitVoices = (notes: readonly NoteEvent[]): Record<VoicePart, NoteEvent[]> => {
  const out: Record<VoicePart, NoteEvent[]> = { S: [], A: [], T: [], B: [] };
  const last: Record<VoicePart, number> = { S: RANGE.S.center, A: RANGE.A.center, T: RANGE.T.center, B: RANGE.B.center };
  const sorted = [...notes].sort((a, z) => a.start - z.start);
  for (let i = 0; i < sorted.length; ) {
    // Notes starting within 60 ms of each other sound as one chord.
    let j = i + 1;
    while (j < sorted.length && sorted[j]!.start - sorted[i]!.start < 0.06) j++;
    const group = sorted
      .slice(i, j)
      .sort((a, z) => z.velocity * (z.end - z.start) - a.velocity * (a.end - a.start))
      .slice(0, 4)
      .sort((a, z) => z.pitch - a.pitch);
    i = j;
    let best: VoicePart[] = [];
    let bestCost = Number.POSITIVE_INFINITY;
    for (const parts of combos(group.length)) {
      let cost = 0;
      parts.forEach((v, k) => {
        const p = group[k]!.pitch;
        const r = RANGE[v];
        cost += Math.abs(p - last[v]) + 3 * (Math.max(0, r.low - p) + Math.max(0, p - r.high));
      });
      if (cost < bestCost) {
        bestCost = cost;
        best = parts;
      }
    }
    best.forEach((v, k) => {
      const note = { ...group[k]! };
      const prev = out[v].at(-1);
      if (prev && prev.end > note.start) prev.end = note.start;
      if (prev && prev.end - prev.start < 0.05) out[v].pop();
      out[v].push(note);
      last[v] = note.pitch;
    });
  }
  return out;
};

export type ChoirInput = {
  title: string;
  artist: string;
  bpm: number;
  key?: KeyResult;
  voices: Record<VoicePart, readonly QNote[]>;
  harmonies: readonly Harmony[];
  /** Lyric lines, shown above the soprano at the tick where each one starts. */
  lyrics: readonly { tick: number; text: string }[];
};

const CLEF: Record<VoicePart, string> = {
  S: '<clef><sign>G</sign><line>2</line></clef>',
  A: '<clef><sign>G</sign><line>2</line></clef>',
  T: '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>',
  B: '<clef><sign>F</sign><line>4</line></clef>',
};

/** SATB choir score: one staff per voice, chord symbols and lyric lines above the soprano. */
export const buildChoirXml = (input: ChoirInput): string => {
  const all = VOICE_PARTS.flatMap((v) => input.voices[v]);
  let first = Number.POSITIVE_INFINITY;
  let end = 1;
  for (const n of all) {
    first = Math.min(first, n.start);
    end = Math.max(end, n.start + n.dur);
  }
  for (const h of input.harmonies) end = Math.max(end, h.tick + 1);
  const skip = Number.isFinite(first) ? Math.floor(first / TICKS_PER_BAR) * TICKS_PER_BAR : 0;
  end -= skip;
  const bars = Math.max(1, Math.ceil(end / TICKS_PER_BAR));
  const total = bars * TICKS_PER_BAR;
  const fifths = keyFifths(input.key);
  const flats = fifths < 0;
  const harmonies = new Map(input.harmonies.map((h) => [h.tick - skip, h.raw]).filter(([t]) => (t as number) >= 0) as [number, string][]);
  const lyrics = new Map(input.lyrics.map((l) => [Math.max(0, l.tick - skip), l.text]));
  const barLines = Array.from({ length: bars }, (_, i) => i * TICKS_PER_BAR);
  const tempo = `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${input.bpm}</per-minute></metronome></direction-type><sound tempo="${input.bpm}"/></direction>`;

  const part = (v: VoicePart, index: number) => {
    const notes = input.voices[v].map((n) => ({ ...n, start: n.start - skip })).filter((n) => n.start >= 0);
    const top = v === 'S';
    const cuts = new Set([...barLines, ...(top ? [...harmonies.keys(), ...lyrics.keys()] : [])]);
    const pieces = timeline(notes, cuts, total);
    const noteXml = (p: Piece) => {
      if (p.note === undefined) return `<note><rest/><duration>${p.dur}</duration><voice>1</voice><type>${p.type}</type>${p.dot ? '<dot/>' : ''}</note>`;
      const ties = `${p.tieStop ? '<tie type="stop"/>' : ''}${p.tieStart ? '<tie type="start"/>' : ''}`;
      const tied = p.tieStop || p.tieStart ? `<notations>${p.tieStop ? '<tied type="stop"/>' : ''}${p.tieStart ? '<tied type="start"/>' : ''}</notations>` : '';
      return `<note>${pitchXml(notes[p.note]!.pitch, flats)}<duration>${p.dur}</duration>${ties}<voice>1</voice><type>${p.type}</type>${p.dot ? '<dot/>' : ''}${tied}</note>`;
    };
    let xml = `<part id="P${index + 1}">`;
    for (let bar = 0; bar < bars; bar++) {
      const from = bar * TICKS_PER_BAR;
      const inBar = pieces.filter((p) => p.start >= from && p.start < from + TICKS_PER_BAR);
      xml += `<measure number="${bar + 1}">`;
      if (bar === 0) xml += `<attributes><divisions>4</divisions><key><fifths>${fifths}</fifths><mode>${input.key?.mode ?? 'major'}</mode></key><time><beats>4</beats><beat-type>4</beat-type></time>${CLEF[v]}</attributes>${top ? tempo : ''}`;
      const marks = top && inBar.some((p) => harmonies.has(p.start) || lyrics.has(p.start));
      if (!marks && inBar.every((p) => p.note === undefined)) xml += `<note><rest measure="yes"/><duration>${TICKS_PER_BAR}</duration><voice>1</voice></note>`;
      else
        for (const p of inBar) {
          if (top && lyrics.has(p.start)) xml += `<direction placement="above"><direction-type><words>${escape(lyrics.get(p.start)!)}</words></direction-type></direction>`;
          if (top && harmonies.has(p.start)) xml += harmonyXml(harmonies.get(p.start)!, flats);
          xml += noteXml(p);
        }
      xml += '</measure>';
    }
    return `${xml}</part>`;
  };

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    `<score-partwise version="4.0"><work><work-title>${escape(input.title)}</work-title></work>`,
    `<identification><creator type="composer">${escape(input.artist)}</creator><encoding><software>will-music</software></encoding></identification>`,
    `<part-list>${VOICE_PARTS.map((v, i) => `<score-part id="P${i + 1}"><part-name>${PART_NAMES[v]}</part-name></score-part>`).join('')}</part-list>`,
    ...VOICE_PARTS.map(part),
    '</score-partwise>',
  ].join('\n');
};
