/** Sheet → MusicXML 4.0: what alphaTab draws and plays, and what the musician downloads. Divisions = 24 per quarter, so
 * a MusicXML duration is exactly the model's ticks. */
import { escape } from '@will-music/engine';
import { DRUM_MIDI, type DrumPiece, type NotePitch, NOTE_NAMES, type Sheet, type SheetEvent, eventTicks, isDrum, measureTicks, staffClef } from './model.ts';

const PROGRAM: Record<Sheet['sound'], number> = { piano: 1, guitar: 25, bass: 34, melody: 74, drums: 1 };
const INSTRUMENT_NAME: Record<Sheet['sound'], string> = { piano: 'Piano', guitar: 'Violão', bass: 'Baixo', melody: 'Melodia', drums: 'Bateria' };
/** Where each drum piece sits on the five-line percussion staff, and its notehead. */
const DRUM_DISPLAY: Record<DrumPiece, { step: string; octave: number; head?: string }> = {
  kick: { step: 'F', octave: 4 }, snare: { step: 'C', octave: 5 }, hihatClosed: { step: 'G', octave: 5, head: 'x' }, hihatOpen: { step: 'G', octave: 5, head: 'circle-x' },
  tomHigh: { step: 'E', octave: 5 }, tomMid: { step: 'D', octave: 5 }, tomFloor: { step: 'A', octave: 4 }, crash: { step: 'A', octave: 5, head: 'x' }, ride: { step: 'F', octave: 5, head: 'x' },
};
const UNIT_TYPE: Record<number, string> = { 2: 'half', 4: 'quarter', 8: 'eighth' };

export type MusicXmlOptions = {
  /** Writes each note's name (Dó, Ré…) under it, for reading practice. */
  noteNames?: boolean;
};

const clefXml = (sheet: Sheet, staff: number, number?: number) => {
  const clef = staffClef(sheet, staff);
  const n = number ? ` number="${number}"` : '';
  if (clef === 'percussion') return `<clef${n}><sign>percussion</sign></clef>`;
  const octave = sheet.staffType === 'single' && sheet.clefOctave === -1 ? '<clef-octave-change>-1</clef-octave-change>' : '';
  return clef === 'bass' ? `<clef${n}><sign>F</sign><line>4</line>${octave}</clef>` : `<clef${n}><sign>G</sign><line>2</line>${octave}</clef>`;
};

const directionXml = (e: SheetEvent, staff?: number) => {
  const s = staff ? `<staff>${staff}</staff>` : '';
  let out = '';
  if (e.chordSymbol) out += `<direction placement="above"><direction-type><words font-weight="bold">${escape(e.chordSymbol)}</words></direction-type>${s}</direction>`;
  if (e.dynamic) out += `<direction placement="below"><direction-type><dynamics><${e.dynamic}/></dynamics></direction-type>${s}<sound dynamics="${({ pp: 36, p: 54, mp: 72, mf: 89, f: 106, ff: 124 })[e.dynamic]}"/></direction>`;
  return out;
};

const noteXml = (sheet: Sheet, e: SheetEvent, voice: number, staff: number | undefined, tieStop: boolean, triplet: 'start' | 'stop' | 'mid' | null, opts: MusicXmlOptions): string => {
  const duration = eventTicks(e, sheet);
  const staffTag = staff ? `<staff>${staff}</staff>` : '';
  const type = `<type>${e.duration}</type>${e.dots ? '<dot/>' : ''}`;
  const tm = e.triplet ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>' : '';
  if (e.kind !== 'note' || !e.pitches?.length) {
    const fermata = e.articulations?.includes('fermata') ? '<fermata/>' : '';
    const tuplet = triplet === 'start' || triplet === 'stop' ? `<tuplet type="${triplet}"/>` : '';
    const notations = fermata || tuplet ? `<notations>${tuplet}${fermata}</notations>` : '';
    return e.kind === 'measureRest'
      ? `<note><rest measure="yes"/><duration>${duration}</duration><voice>${voice}</voice>${staffTag}${notations}</note>`
      : `<note><rest/><duration>${duration}</duration><voice>${voice}</voice>${type}${tm}${staffTag}${notations}</note>`;
  }
  return e.pitches.map((p, i) => {
    const chord = i > 0 ? '<chord/>' : '';
    const ties = `${tieStop ? '<tie type="stop"/>' : ''}${e.tieToNext ? '<tie type="start"/>' : ''}`;
    const tied = `${tieStop ? '<tied type="stop"/>' : ''}${e.tieToNext ? '<tied type="start"/>' : ''}`;
    const marks = i === 0 ? e.articulations ?? [] : [];
    const arts = marks.filter((a) => a !== 'fermata').map((a) => `<${a}/>`).join('');
    const fermata = marks.includes('fermata') ? '<fermata/>' : '';
    const tuplet = i === 0 && (triplet === 'start' || triplet === 'stop') ? `<tuplet type="${triplet}"/>` : '';
    let pitch: string;
    let head = '';
    let instrument = '';
    let fingering = '';
    let lyric = '';
    if (isDrum(p)) {
      const d = DRUM_DISPLAY[p.drum];
      pitch = `<unpitched><display-step>${d.step}</display-step><display-octave>${d.octave}</display-octave></unpitched>`;
      if (d.head) head = `<notehead>${d.head}</notehead>`;
      instrument = `<instrument id="P1-${p.drum}"/>`;
    } else {
      const n = p as NotePitch;
      pitch = `<pitch><step>${n.step}</step>${n.alter ? `<alter>${n.alter}</alter>` : ''}<octave>${n.octave}</octave></pitch>`;
      if (n.fingering) fingering = `<technical><fingering>${escape(n.fingering)}</fingering></technical>`;
      if (opts.noteNames && i === 0) lyric = `<lyric number="1"><syllabic>single</syllabic><text>${(e.pitches as NotePitch[]).map((x) => NOTE_NAMES[x.step] + (x.alter > 0 ? '♯' : x.alter < 0 ? '♭' : '')).join(' ')}</text></lyric>`;
    }
    const notationsBody = `${tied}${tuplet}${arts ? `<articulations>${arts}</articulations>` : ''}${fermata}${fingering}`;
    const notations = notationsBody ? `<notations>${notationsBody}</notations>` : '';
    return `<note>${chord}${pitch}<duration>${duration}</duration>${ties}${instrument}<voice>${voice}</voice>${type}${tm}${head}${staffTag}${notations}${lyric}</note>`;
  }).join('');
};

/** Notes of one staff in one measure, with ties continued from the previous event and triplet brackets. */
const staffMeasureXml = (sheet: Sheet, staffIndex: number, m: number, voice: number, staffTag: number | undefined, opts: MusicXmlOptions): string => {
  const staff = sheet.staves[staffIndex]!;
  const events = staff.measures[m]!.events;
  let previous: SheetEvent | undefined = staff.measures[m - 1]?.events.at(-1);
  let tripletCount = 0;
  return events.map((e) => {
    let triplet: 'start' | 'stop' | 'mid' | null = null;
    if (e.triplet) {
      tripletCount++;
      triplet = tripletCount === 1 ? 'start' : tripletCount === 3 ? 'stop' : 'mid';
      if (tripletCount === 3) tripletCount = 0;
    } else tripletCount = 0;
    const out = directionXml(e, staffTag) + noteXml(sheet, e, voice, staffTag, !!previous?.tieToNext && e.kind === 'note', triplet, opts);
    previous = e;
    return out;
  }).join('');
};

export const sheetToMusicXml = (sheet: Sheet, opts: MusicXmlOptions = {}): string => {
  const drums = sheet.staffType === 'drums';
  const piano = sheet.staffType === 'piano';
  const name = escape(INSTRUMENT_NAME[sheet.sound]);
  const instruments = drums
    ? (Object.keys(DRUM_MIDI) as DrumPiece[]).map((d) => `<score-instrument id="P1-${d}"><instrument-name>${d}</instrument-name></score-instrument>`).join('')
      + (Object.keys(DRUM_MIDI) as DrumPiece[]).map((d) => `<midi-instrument id="P1-${d}"><midi-channel>10</midi-channel><midi-unpitched>${DRUM_MIDI[d] + 1}</midi-unpitched></midi-instrument>`).join('')
    : `<score-instrument id="P1-I1"><instrument-name>${name}</instrument-name></score-instrument><midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>${PROGRAM[sheet.sound]}</midi-program></midi-instrument>`;
  const unit = sheet.timeSignature.unit;
  const quarterBpm = Math.round((sheet.tempo * 4) / unit);
  const total = measureTicks(sheet);
  const measures = sheet.staves[0]!.measures.map((_, m) => {
    let head = '';
    if (m === 0) {
      const transpose = sheet.staffType === 'single' && sheet.clefOctave === -1 ? '<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>' : '';
      const clefs = piano ? clefXml(sheet, 0, 1) + clefXml(sheet, 1, 2) : clefXml(sheet, 0);
      head = `<attributes><divisions>24</divisions><key><fifths>${sheet.keyFifths}</fifths></key><time><beats>${sheet.timeSignature.beats}</beats><beat-type>${unit}</beat-type></time>${piano ? '<staves>2</staves>' : ''}${clefs}${transpose}</attributes>`;
      head += `<direction placement="above"><direction-type><metronome><beat-unit>${UNIT_TYPE[unit] ?? 'quarter'}</beat-unit><per-minute>${sheet.tempo}</per-minute></metronome></direction-type><sound tempo="${quarterBpm}"/></direction>`;
      if (sheet.instructions?.trim()) head += `<direction placement="above"><direction-type><words font-style="italic">${escape(sheet.instructions.trim().slice(0, 200))}</words></direction-type></direction>`;
    }
    const body = piano
      ? `${staffMeasureXml(sheet, 0, m, 1, 1, opts)}<backup><duration>${total}</duration></backup>${staffMeasureXml(sheet, 1, m, 5, 2, opts)}`
      : staffMeasureXml(sheet, 0, m, 1, undefined, opts);
    return `<measure number="${m + 1}">${head}${body}</measure>`;
  }).join('');
  const composer = sheet.author.trim() ? `<identification><creator type="composer">${escape(sheet.author.trim())}</creator></identification>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><work><work-title>${escape(sheet.title)}</work-title></work>${composer}<part-list><score-part id="P1"><part-name>${name}</part-name>${instruments}</score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
};
