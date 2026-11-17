/**
 * Written score ("partitura escrita"): the app's own model, the source of truth for the editor. It is turned into
 * MusicXML to draw/play (alphaTab) and to export. Durations use ticks: a whole note is 96, so dotted sixteenths
 * and eighth/quarter triplets need no fractions. A measure always adds up to its time signature.
 */

export type StaffType = 'single' | 'piano' | 'drums';
export type SheetSound = 'piano' | 'guitar' | 'bass' | 'melody' | 'drums';
export type Clef = 'treble' | 'bass';
export type DurationName = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
export type Articulation = 'accent' | 'staccato' | 'tenuto' | 'fermata';
export type Dynamic = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff';
export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type DrumPiece = 'kick' | 'snare' | 'hihatClosed' | 'hihatOpen' | 'tomHigh' | 'tomMid' | 'tomFloor' | 'crash' | 'ride';

export type NotePitch = { step: Step; alter: -1 | 0 | 1; octave: number; fingering?: string };
export type DrumPitch = { drum: DrumPiece };
export type Pitch = NotePitch | DrumPitch;

export type SheetEvent = {
  kind: 'note' | 'rest' | 'measureRest';
  duration: DurationName;
  dots: 0 | 1;
  /** Part of a triplet: three consecutive events of the same figure. */
  triplet?: true;
  pitches?: Pitch[];
  tieToNext?: true;
  articulations?: Articulation[];
  dynamic?: Dynamic;
  chordSymbol?: string;
};
export type Measure = { events: SheetEvent[] };
export type Staff = { measures: Measure[] };

export type Sheet = {
  id: string;
  title: string;
  author: string;
  instructions?: string;
  staffType: StaffType;
  clef?: Clef;
  /** −1: clef with a small 8 below (guitar and bass read an octave above the sound). */
  clefOctave?: 0 | -1;
  sound: SheetSound;
  keyFifths: number;
  timeSignature: { beats: number; unit: 2 | 4 | 8 };
  /** Beats per minute of the time signature's unit. */
  tempo: number;
  staves: Staff[];
  songId?: string;
  /** Link-shared copy (id of `wmSheets/{id}`) and whether local edits differ from it. */
  shared?: { id: string; publishedAt: string; dirty: boolean };
  /** Copy saved from a sheet shared by someone else. */
  sharedFrom?: { id: string; ownerName: string };
  createdAt: string;
  updatedAt: string;
};

export const WHOLE = 96;
const BASE: Record<DurationName, number> = { whole: 96, half: 48, quarter: 24, eighth: 12, sixteenth: 6 };
export const DURATIONS: DurationName[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];

export const measureTicks = (sheet: Pick<Sheet, 'timeSignature'>): number => sheet.timeSignature.beats * (WHOLE / sheet.timeSignature.unit);

export const valueTicks = (duration: DurationName, dots: 0 | 1 = 0, triplet = false): number => {
  let ticks = BASE[duration] * (dots ? 1.5 : 1);
  if (triplet) ticks = (ticks * 2) / 3;
  return ticks;
};

export const eventTicks = (event: SheetEvent, sheet: Pick<Sheet, 'timeSignature'>): number =>
  event.kind === 'measureRest' ? measureTicks(sheet) : valueTicks(event.duration, event.dots, !!event.triplet);

/** Plain (non-triplet) values that add up to `ticks`, largest first; used for rests and for notes split at a bar line. */
export const splitTicks = (ticks: number): { duration: DurationName; dots: 0 | 1 }[] => {
  const out: { duration: DurationName; dots: 0 | 1 }[] = [];
  let left = ticks;
  const options = DURATIONS.flatMap((d) => [{ duration: d, dots: 1 as const }, { duration: d, dots: 0 as const }]).filter((o) => valueTicks(o.duration, o.dots) <= WHOLE);
  while (left > 0) {
    const pick = options.find((o) => valueTicks(o.duration, o.dots) <= left);
    if (!pick) break; // smaller than a sixteenth: cannot happen with whole-tick values
    out.push(pick);
    left -= valueTicks(pick.duration, pick.dots);
  }
  return out;
};

export const restsFor = (ticks: number): SheetEvent[] => splitTicks(ticks).map((v) => ({ kind: 'rest', duration: v.duration, dots: v.dots }));
export const measureRest = (): SheetEvent => ({ kind: 'measureRest', duration: 'whole', dots: 0 });
export const emptyMeasure = (): Measure => ({ events: [measureRest()] });

const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const isDrum = (p: Pitch): p is DrumPitch => 'drum' in p;
export const midiOf = (p: NotePitch): number => (p.octave + 1) * 12 + STEP_SEMITONES[p.step] + p.alter;

/** Accidental the key signature gives to a letter (F major → B flat). */
export const keyAlter = (step: Step, keyFifths: number): -1 | 0 | 1 => {
  const sharps: Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  if (keyFifths > 0 && sharps.slice(0, keyFifths).includes(step)) return 1;
  if (keyFifths < 0 && [...sharps].reverse().slice(0, -keyFifths).includes(step)) return -1;
  return 0;
};

/** Spells a MIDI number, preferring sharps (going up) or flats (going down / flat keys). */
export const spellMidi = (midi: number, preferFlats: boolean): NotePitch => {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const sharp: [Step, -1 | 0 | 1][] = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const flat: [Step, -1 | 0 | 1][] = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
  const [step, alter] = (preferFlats ? flat : sharp)[pc]!;
  return { step, alter, octave };
};

export const DRUM_MIDI: Record<DrumPiece, number> = { kick: 36, snare: 38, hihatClosed: 42, hihatOpen: 46, tomHigh: 50, tomMid: 47, tomFloor: 43, crash: 49, ride: 51 };
export const DRUM_LABELS: Record<DrumPiece, string> = { kick: 'Bumbo', snare: 'Caixa', hihatClosed: 'Chimbal', hihatOpen: 'Chimbal aberto', tomHigh: 'Tom agudo', tomMid: 'Tom médio', tomFloor: 'Surdo', crash: 'Prato de ataque', ride: 'Prato de condução' };
export const DRUM_PIECES: DrumPiece[] = ['kick', 'snare', 'hihatClosed', 'hihatOpen', 'tomHigh', 'tomMid', 'tomFloor', 'crash', 'ride'];

export const SOUND_LABELS: Record<SheetSound, string> = { piano: 'Piano', guitar: 'Violão/guitarra', bass: 'Baixo', melody: 'Melodia (voz, flauta)', drums: 'Bateria' };
export const NOTE_NAMES: Record<Step, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };

export type NewSheetInput = {
  title: string; author: string; staffType: StaffType; sound: SheetSound; clef?: Clef;
  keyFifths: number; timeSignature: Sheet['timeSignature']; tempo: number; measures: number; songId?: string;
};

export const createSheet = (input: NewSheetInput): Sheet => {
  const stamp = new Date().toISOString();
  const staves = input.staffType === 'piano' ? 2 : 1;
  const sound = input.staffType === 'drums' ? 'drums' : input.staffType === 'piano' ? 'piano' : input.sound;
  const clef = input.staffType === 'single' ? (input.clef ?? (sound === 'bass' ? 'bass' : 'treble')) : undefined;
  return {
    id: crypto.randomUUID(),
    title: input.title.trim() || 'Nova partitura',
    author: input.author.trim(),
    staffType: input.staffType,
    ...(clef ? { clef } : {}),
    ...(input.staffType === 'single' && (sound === 'guitar' || sound === 'bass') ? { clefOctave: -1 as const } : {}),
    sound,
    keyFifths: input.staffType === 'drums' ? 0 : input.keyFifths,
    timeSignature: input.timeSignature,
    tempo: input.tempo,
    staves: Array.from({ length: staves }, () => ({ measures: Array.from({ length: Math.max(1, input.measures) }, emptyMeasure) })),
    ...(input.songId ? { songId: input.songId } : {}),
    createdAt: stamp,
    updatedAt: stamp,
  };
};

/** Clef of a staff: piano = treble then bass; drums use the percussion clef. */
export const staffClef = (sheet: Sheet, staff: number): Clef | 'percussion' =>
  sheet.staffType === 'drums' ? 'percussion' : sheet.staffType === 'piano' ? (staff === 0 ? 'treble' : 'bass') : sheet.clef ?? 'treble';
