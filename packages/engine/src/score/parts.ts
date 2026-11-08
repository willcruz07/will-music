import type { KeyResult } from '../key/key.ts';
import type { DrumKind } from './drums.ts';
import { type Piece, escape, harmonyXml, keyFifths, pitchXml, timeline } from './musicxml.ts';
import { type Harmony, type QNote, TICKS_PER_BAR, skipTicksXml } from './quantize.ts';

export type ChordEvent = { start: number; dur: number; pitches: number[] };

/** Notes that start together become one chord, lasting until the next chord starts (or its shortest note ends). */
export const toChords = (notes: readonly QNote[]): ChordEvent[] => {
  const byStart = new Map<number, QNote[]>();
  for (const n of notes) byStart.set(n.start, [...(byStart.get(n.start) ?? []), n]);
  const starts = [...byStart.keys()].sort((a, z) => a - z);
  return starts.map((start, i) => {
    const group = byStart.get(start)!;
    const next = starts[i + 1] ?? Number.POSITIVE_INFINITY;
    return { start, dur: Math.max(1, group.reduce((m, n) => Math.min(m, n.dur), next - start)), pitches: [...new Set(group.map((n) => n.pitch))].sort((a, z) => a - z) };
  });
};

/** Right hand from middle C up, left hand below. */
export const splitHands = (notes: readonly QNote[], split = 60) => ({
  right: notes.filter((n) => n.pitch >= split),
  left: notes.filter((n) => n.pitch < split),
});

const header = (title: string, artist: string, partList: string, skip: number) =>
  [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    `<score-partwise version="4.0"><work><work-title>${escape(title)}</work-title></work>`,
    `<identification><creator type="composer">${escape(artist)}</creator><encoding><software>will-music</software></encoding>${skipTicksXml(skip)}</identification>`,
    `<part-list>${partList}</part-list>`,
  ].join('\n');

const tempoXml = (bpm: number) =>
  `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`;
const TIME = '<time><beats>4</beats><beat-type>4</beat-type></time>';
const dotXml = (p: Piece) => (p.dot ? '<dot/>' : '');

/** Index of the first bar with content, so a score never opens with bars of silence. */
const firstBarTick = (ticks: number[]) => (ticks.length ? Math.floor(ticks.reduce((m, t) => Math.min(m, t), Number.POSITIVE_INFINITY) / TICKS_PER_BAR) * TICKS_PER_BAR : 0);
// Loops instead of spreads: a dense piano part can exceed the engine's argument limit (65 536 on Safari).
const maxEnd = (values: Iterable<number>) => {
  let m = 1;
  for (const v of values) m = Math.max(m, v);
  return m;
};

export type PianoInput = { title: string; artist: string; bpm: number; key?: KeyResult; notes: readonly QNote[]; harmonies: readonly Harmony[] };

/** Piano grand staff (treble + bass clef) with chord symbols, in the song's key signature. */
export const buildPianoXml = (raw: PianoInput): string => {
  const skip = firstBarTick([...raw.notes.map((n) => n.start), ...raw.harmonies.map((h) => h.tick)]);
  const notes = raw.notes.map((n) => ({ ...n, start: n.start - skip }));
  const harmonies = raw.harmonies.map((h) => ({ ...h, tick: h.tick - skip }));
  const fifths = keyFifths(raw.key);
  const flats = fifths < 0;
  const { right, left } = splitHands(notes);
  const staves = [toChords(right), toChords(left)];
  const end = maxEnd([...notes.map((n) => n.start + n.dur), ...harmonies.map((h) => h.tick + 1)]);
  const bars = Math.ceil(end / TICKS_PER_BAR);
  const total = bars * TICKS_PER_BAR;
  const barLines = Array.from({ length: bars }, (_, i) => i * TICKS_PER_BAR);
  const harmonyAt = new Map(harmonies.map((h) => [h.tick, h.raw]));
  const pieces = [timeline(staves[0]!, new Set([...barLines, ...harmonies.map((h) => h.tick)]), total), timeline(staves[1]!, new Set(barLines), total)];

  const noteXml = (p: Piece, staff: number) => {
    const voice = staff === 1 ? 1 : 5;
    if (p.note === undefined) return `<note><rest/><duration>${p.dur}</duration><voice>${voice}</voice><type>${p.type}</type>${dotXml(p)}<staff>${staff}</staff></note>`;
    const ties = `${p.tieStop ? '<tie type="stop"/>' : ''}${p.tieStart ? '<tie type="start"/>' : ''}`;
    const tied = p.tieStop || p.tieStart ? `<notations>${p.tieStop ? '<tied type="stop"/>' : ''}${p.tieStart ? '<tied type="start"/>' : ''}</notations>` : '';
    return staves[staff - 1]![p.note]!.pitches
      .map((pitch, k) => `<note>${k ? '<chord/>' : ''}${pitchXml(pitch, flats)}<duration>${p.dur}</duration>${ties}<voice>${voice}</voice><type>${p.type}</type>${dotXml(p)}<staff>${staff}</staff>${tied}</note>`)
      .join('');
  };

  let part = '<part id="P1">';
  for (let bar = 0; bar < bars; bar++) {
    const from = bar * TICKS_PER_BAR;
    part += `<measure number="${bar + 1}">`;
    if (bar === 0) {
      part += `<attributes><divisions>4</divisions><key><fifths>${fifths}</fifths><mode>${raw.key?.mode ?? 'major'}</mode></key>${TIME}<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>${tempoXml(raw.bpm)}`;
    }
    for (const staff of [1, 2]) {
      if (staff === 2) part += `<backup><duration>${TICKS_PER_BAR}</duration></backup>`;
      const inBar = pieces[staff - 1]!.filter((p) => p.start >= from && p.start < from + TICKS_PER_BAR);
      const silent = inBar.every((p) => p.note === undefined) && (staff === 2 || !inBar.some((p) => harmonyAt.has(p.start)));
      if (silent) {
        part += `<note><rest measure="yes"/><duration>${TICKS_PER_BAR}</duration><voice>${staff === 1 ? 1 : 5}</voice><staff>${staff}</staff></note>`;
        continue;
      }
      for (const p of inBar) {
        if (staff === 1 && harmonyAt.has(p.start)) part += harmonyXml(harmonyAt.get(p.start)!, flats);
        part += noteXml(p, staff);
      }
    }
    part += '</measure>';
  }
  return `${header(raw.title, raw.artist, '<score-part id="P1"><part-name>Teclado</part-name></score-part>', skip)}\n${part}</part>\n</score-partwise>`;
};

/** General MIDI drum notes and where each sits on the percussion staff. */
const KIT: Record<DrumKind, { id: string; name: string; step: string; octave: number; midi: number; head?: string }> = {
  kick: { id: 'P1-I36', name: 'Bumbo', step: 'F', octave: 4, midi: 36 },
  snare: { id: 'P1-I38', name: 'Caixa', step: 'C', octave: 5, midi: 38 },
  hihat: { id: 'P1-I42', name: 'Chimbal', step: 'G', octave: 5, midi: 42, head: 'x' },
};
const KIT_ORDER: DrumKind[] = ['kick', 'snare', 'hihat'];

export type DrumInput = { title: string; artist: string; bpm: number; hits: readonly { tick: number; kind: DrumKind }[] };

/** Percussion staff with kick, snare and hi-hat; each hit lasts until the next one (at most a quarter, never across the bar). */
export const buildDrumXml = (raw: DrumInput): string => {
  const skip = firstBarTick(raw.hits.map((h) => h.tick));
  const byTick = new Map<number, Set<DrumKind>>();
  for (const h of raw.hits) byTick.set(h.tick - skip, (byTick.get(h.tick - skip) ?? new Set()).add(h.kind));
  const ticks = [...byTick.keys()].sort((a, z) => a - z);
  const events = ticks.map((start, i) => {
    const barEnd = (Math.floor(start / TICKS_PER_BAR) + 1) * TICKS_PER_BAR;
    return { start, dur: Math.max(1, Math.min(4, (ticks[i + 1] ?? Number.POSITIVE_INFINITY) - start, barEnd - start)), kinds: KIT_ORDER.filter((k) => byTick.get(start)!.has(k)) };
  });
  const end = maxEnd(events.map((e) => e.start + e.dur));
  const bars = Math.ceil(end / TICKS_PER_BAR);
  const total = bars * TICKS_PER_BAR;
  const pieces = timeline(events, new Set(Array.from({ length: bars }, (_, i) => i * TICKS_PER_BAR)), total);

  const instruments = KIT_ORDER.map((k) => `<score-instrument id="${KIT[k].id}"><instrument-name>${KIT[k].name}</instrument-name></score-instrument>`).join('');
  const midi = KIT_ORDER.map((k) => `<midi-instrument id="${KIT[k].id}"><midi-channel>10</midi-channel><midi-unpitched>${KIT[k].midi + 1}</midi-unpitched></midi-instrument>`).join('');
  let part = '<part id="P1">';
  for (let bar = 0; bar < bars; bar++) {
    const from = bar * TICKS_PER_BAR;
    part += `<measure number="${bar + 1}">`;
    if (bar === 0) part += `<attributes><divisions>4</divisions><key><fifths>0</fifths></key>${TIME}<clef><sign>percussion</sign><line>2</line></clef></attributes>${tempoXml(raw.bpm)}`;
    const inBar = pieces.filter((p) => p.start >= from && p.start < from + TICKS_PER_BAR);
    if (inBar.every((p) => p.note === undefined)) {
      part += `<note><rest measure="yes"/><duration>${TICKS_PER_BAR}</duration><voice>1</voice></note>`;
    } else {
      for (const p of inBar) {
        if (p.note === undefined || p.tieStop) {
          part += `<note><rest/><duration>${p.dur}</duration><voice>1</voice><type>${p.type}</type>${dotXml(p)}</note>`;
          continue;
        }
        part += events[p.note]!.kinds
          .map((kind, k) => {
            const d = KIT[kind];
            return `<note>${k ? '<chord/>' : ''}<unpitched><display-step>${d.step}</display-step><display-octave>${d.octave}</display-octave></unpitched><duration>${p.dur}</duration><instrument id="${d.id}"/><voice>1</voice><type>${p.type}</type>${dotXml(p)}<stem>up</stem>${d.head ? `<notehead>${d.head}</notehead>` : ''}</note>`;
          })
          .join('');
      }
    }
    part += '</measure>';
  }
  return `${header(raw.title, raw.artist, `<score-part id="P1"><part-name>Bateria</part-name>${instruments}${midi}</score-part>`, skip)}\n${part}</part>\n</score-partwise>`;
};
