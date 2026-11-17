/**
 * Editing operations on a Sheet. Every operation returns a new sheet (the input is never mutated) and keeps each
 * measure adding up to the time signature: a new value overwrites what is under it, the uncovered remainder becomes
 * rests, a value longer than the measure continues in the next one tied, deleting leaves a rest.
 */
import {
  type Articulation, type Dynamic, type NotePitch, type Pitch, type Sheet, type SheetEvent, type Step,
  emptyMeasure, eventTicks, isDrum, keyAlter, measureRest, measureTicks, midiOf, restsFor, spellMidi, splitTicks, staffClef, valueTicks,
} from './model.ts';

export type Cursor = { staff: number; measure: number; event: number };
export type EditResult = { sheet: Sheet; cursor: Cursor; placed?: Cursor; error?: string };

const clone = (sheet: Sheet): Sheet => structuredClone(sheet);
const touch = (sheet: Sheet): Sheet => ({ ...sheet, updatedAt: new Date().toISOString(), ...(sheet.shared ? { shared: { ...sheet.shared, dirty: true } } : {}) });

/** Start tick of every event of a measure. */
const starts = (events: SheetEvent[], sheet: Sheet): number[] => {
  const out: number[] = [];
  let t = 0;
  for (const e of events) { out.push(t); t += eventTicks(e, sheet); }
  return out;
};

/** Index ranges [from, to) of the triplet groups in a measure (runs of triplet events, three at a time). */
const tripletGroups = (events: SheetEvent[]): [number, number][] => {
  const groups: [number, number][] = [];
  for (let i = 0; i < events.length;) {
    if (!events[i]!.triplet) { i++; continue; }
    const end = Math.min(events.length, i + 3);
    groups.push([i, end]);
    i = end;
  }
  return groups;
};
const groupOf = (events: SheetEvent[], index: number): [number, number] | undefined => tripletGroups(events).find(([a, b]) => index >= a && index < b);

/** A measure's events with a whole-measure rest spelled as ordinary rests, so it can be overwritten. */
const expanded = (events: SheetEvent[], sheet: Sheet): SheetEvent[] =>
  events.length === 1 && events[0]!.kind === 'measureRest' ? restsFor(measureTicks(sheet)) : events;

/** Replaces [start, start + length) of a measure with `inserted` (which must add up to `length`). */
const overwrite = (eventsIn: SheetEvent[], sheet: Sheet, start: number, length: number, inserted: SheetEvent[]): SheetEvent[] => {
  let events = expanded(eventsIn, sheet);
  // Triplet groups touched by the region become plain rests first (a group is only replaced whole).
  const end = start + length;
  for (const [a, b] of [...tripletGroups(events)].reverse()) {
    const pos = starts(events, sheet);
    const gs = pos[a]!;
    const ge = gs + events.slice(a, b).reduce((n, e) => n + eventTicks(e, sheet), 0);
    if (ge <= start || gs >= end) continue;
    if (gs >= start && ge <= end) continue; // fully covered: removed below
    events = [...events.slice(0, a), ...restsFor(ge - gs), ...events.slice(b)];
  }
  const pos = starts(events, sheet);
  const out: SheetEvent[] = [];
  let insertedDone = false;
  events.forEach((e, i) => {
    const es = pos[i]!;
    const ee = es + eventTicks(e, sheet);
    if (ee <= start || es >= end) {
      if (es >= end && !insertedDone) { out.push(...inserted); insertedDone = true; }
      out.push(e);
      return;
    }
    if (es < start) out.push(...restsFor(start - es));
    if (!insertedDone) { out.push(...inserted); insertedDone = true; }
    if (ee > end) out.push(...restsFor(ee - end));
  });
  if (!insertedDone) out.push(...inserted);
  return out;
};

/** Event index that starts at `tick` (or the one containing it). */
const indexAt = (events: SheetEvent[], sheet: Sheet, tick: number): number => {
  const pos = starts(events, sheet);
  let index = 0;
  pos.forEach((p, i) => { if (p <= tick) index = i; });
  return index;
};

const ensureMeasure = (sheet: Sheet, measure: number) => {
  while (sheet.staves[0]!.measures.length <= measure) for (const staff of sheet.staves) staff.measures.push(emptyMeasure());
};

const samePitches = (a: Pitch[] = [], b: Pitch[] = []) => a.length === b.length && a.every((p, i) => JSON.stringify(p) === JSON.stringify(b[i]));

/** Removes broken ties and turns all-rest measures back into a whole-measure rest. */
export const normalize = (sheet: Sheet): Sheet => {
  for (const staff of sheet.staves) {
    staff.measures.forEach((measure, m) => {
      measure.events.forEach((e, i) => {
        if (!e.tieToNext) return;
        const next = measure.events[i + 1] ?? staff.measures[m + 1]?.events[0];
        if (e.kind !== 'note' || !next || next.kind !== 'note' || !samePitches(e.pitches, next.pitches)) delete e.tieToNext;
      });
      if (measure.events.every((e) => e.kind !== 'note') && !(measure.events.length === 1 && measure.events[0]!.kind === 'measureRest')) {
        const keep = measure.events.some((e) => e.dynamic || e.chordSymbol || e.articulations?.length);
        if (!keep) measure.events = [measureRest()];
      }
    });
  }
  return sheet;
};

const cursorAfter = (sheet: Sheet, staff: number, measure: number, tick: number): Cursor => {
  const ticks = measureTicks(sheet);
  if (tick >= ticks) {
    ensureMeasure(sheet, measure + 1);
    return { staff, measure: measure + 1, event: 0 };
  }
  return { staff, measure, event: indexAt(sheet.staves[staff]!.measures[measure]!.events, sheet, tick) };
};

/**
 * Puts a note or rest of the given value at the cursor. Triplet values fill a group of three (the other two become
 * triplet rests) unless the cursor is already on a triplet of the same figure, which is simply replaced.
 */
export const placeEvent = (input: Sheet, at: Cursor, event: SheetEvent): EditResult => {
  const sheet = clone(input);
  const staff = sheet.staves[at.staff]!;
  const ticks = measureTicks(sheet);
  let events = expanded(staff.measures[at.measure]!.events, sheet);
  let index = Math.min(at.event, events.length - 1);
  const value = valueTicks(event.duration, event.dots, !!event.triplet);
  const current = events[index]!;

  if (event.triplet) {
    if (current.triplet && current.duration === event.duration) {
      events = events.map((e, i) => (i === index ? { ...event } : e));
      staff.measures[at.measure]!.events = events;
      const tick = starts(events, sheet)[index]! + value;
      const result = normalize(touch(sheet));
      return { sheet: result, placed: { ...at, event: index }, cursor: cursorAfter(result, at.staff, at.measure, tick) };
    }
    const group = groupOf(events, index);
    const start = group ? starts(events, sheet)[group[0]]! : starts(events, sheet)[index]!;
    const span = value * 3;
    if (start + span > ticks) return { sheet: input, cursor: at, error: 'A tercina não cabe no resto do compasso.' };
    const rest: SheetEvent = { kind: 'rest', duration: event.duration, dots: 0, triplet: true };
    events = overwrite(events, sheet, start, span, [{ ...event }, { ...rest }, { ...rest }]);
    staff.measures[at.measure]!.events = events;
    const placedIndex = indexAt(events, sheet, start);
    const result = normalize(touch(sheet));
    return { sheet: result, placed: { ...at, event: placedIndex }, cursor: { ...at, event: placedIndex + 1 } };
  }

  // A plain value on a triplet starts at the beginning of its group.
  const group = current.triplet ? groupOf(events, index) : undefined;
  if (group) index = group[0];
  let start = starts(events, sheet)[index]!;
  let measure = at.measure;
  let left = value;
  let placed: Cursor | undefined;
  let previousPart: SheetEvent | undefined;
  while (left > 0) {
    ensureMeasure(sheet, measure);
    const target = sheet.staves[at.staff]!.measures[measure]!;
    const room = ticks - start;
    const length = Math.min(room, left);
    const parts: SheetEvent[] = length === value && left === value
      ? [{ ...event }]
      : splitTicks(length).map((v) => ({ ...event, duration: v.duration, dots: v.dots }));
    if (event.kind === 'note') parts.forEach((p, i) => { if (i < parts.length - 1 || left > length) p.tieToNext = true; else delete p.tieToNext; });
    // Marks (dynamics, chord symbols, articulations) stay on the first part only.
    parts.slice(previousPart ? 0 : 1).forEach((p) => { delete p.dynamic; delete p.chordSymbol; delete p.articulations; });
    if (previousPart && event.kind === 'note') previousPart.tieToNext = true;
    target.events = overwrite(target.events, sheet, start, length, parts);
    if (!placed) placed = { staff: at.staff, measure, event: indexAt(target.events, sheet, start) };
    previousPart = parts[parts.length - 1];
    left -= length;
    if (left > 0) { measure++; start = 0; }
    else {
      const result = normalize(touch(sheet));
      return { sheet: result, placed, cursor: cursorAfter(result, at.staff, measure, start + length) };
    }
  }
  return { sheet: input, cursor: at };
};

/** The note or rest under the cursor becomes a rest of the same value. */
export const deleteAt = (input: Sheet, at: Cursor): EditResult => {
  const sheet = clone(input);
  const measure = sheet.staves[at.staff]!.measures[at.measure]!;
  const e = measure.events[at.event];
  if (!e || e.kind === 'measureRest') return { sheet: input, cursor: at };
  measure.events[at.event] = { kind: 'rest', duration: e.duration, dots: e.dots, ...(e.triplet ? { triplet: true as const } : {}) };
  const result = normalize(touch(sheet));
  const events = result.staves[at.staff]!.measures[at.measure]!.events;
  return { sheet: result, cursor: { ...at, event: Math.min(at.event, events.length - 1) } };
};

const eventAt = (sheet: Sheet, at: Cursor) => sheet.staves[at.staff]?.measures[at.measure]?.events[at.event];

/** Octave of a letter nearest to the previous note of the staff (or the middle of the clef). */
export const nearestPitch = (sheet: Sheet, at: Cursor, step: Step): NotePitch => {
  let reference: number | undefined;
  const staff = sheet.staves[at.staff]!;
  for (let m = at.measure; m >= 0 && reference === undefined; m--) {
    const events = staff.measures[m]!.events;
    for (let i = (m === at.measure ? at.event - 1 : events.length - 1); i >= 0; i--) {
      const p = events[i]!.pitches?.find((x): x is NotePitch => !isDrum(x));
      if (events[i]!.kind === 'note' && p) { reference = midiOf(p); break; }
    }
  }
  reference ??= staffClef(sheet, at.staff) === 'bass' ? 50 : 71;
  const alter = keyAlter(step, sheet.keyFifths);
  let best: NotePitch = { step, alter, octave: 4 };
  for (let octave = 1; octave <= 7; octave++) {
    const candidate: NotePitch = { step, alter, octave };
    if (Math.abs(midiOf(candidate) - reference) < Math.abs(midiOf(best) - reference)) best = candidate;
  }
  return best;
};

const editEvent = (input: Sheet, at: Cursor, change: (e: SheetEvent) => SheetEvent | null): EditResult => {
  const sheet = clone(input);
  const events = sheet.staves[at.staff]?.measures[at.measure]?.events;
  const e = events?.[at.event];
  if (!events || !e) return { sheet: input, cursor: at };
  const next = change(e);
  if (!next) return { sheet: input, cursor: at };
  events[at.event] = next;
  return { sheet: normalize(touch(sheet)), cursor: at };
};

const sortPitches = (pitches: Pitch[]) => [...pitches].sort((a, b) => (isDrum(a) || isDrum(b) ? 0 : midiOf(a) - midiOf(b)));

/** Adds a pitch (or drum piece) to the note under the cursor, making a chord. */
export const addPitch = (sheet: Sheet, at: Cursor, pitch: Pitch): EditResult =>
  editEvent(sheet, at, (e) => {
    if (e.kind !== 'note') return null;
    if (e.pitches?.some((p) => JSON.stringify(p) === JSON.stringify(pitch))) return null;
    return { ...e, pitches: sortPitches([...(e.pitches ?? []), pitch]) };
  });

/** Moves every pitch of the note by semitones (±1) or octaves (±12). */
export const transposeAt = (sheet: Sheet, at: Cursor, semitones: number): EditResult =>
  editEvent(sheet, at, (e) => {
    if (e.kind !== 'note' || !e.pitches?.length || e.pitches.some(isDrum)) return null;
    const flats = semitones < 0 || sheet.keyFifths < 0;
    return {
      ...e,
      pitches: (e.pitches as NotePitch[]).map((p) => {
        if (Math.abs(semitones) === 12) return { ...p, octave: p.octave + Math.sign(semitones) };
        const spelled = spellMidi(midiOf(p) + semitones, flats);
        return { ...spelled, ...(p.fingering ? { fingering: p.fingering } : {}) };
      }),
    };
  });

export const toggleArticulation = (sheet: Sheet, at: Cursor, articulation: Articulation): EditResult =>
  editEvent(sheet, at, (e) => {
    if (e.kind === 'measureRest' && articulation !== 'fermata') return null;
    const list = e.articulations ?? [];
    const next = list.includes(articulation) ? list.filter((a) => a !== articulation) : [...list, articulation];
    const out = { ...e, articulations: next };
    if (!next.length) delete (out as SheetEvent).articulations;
    return out;
  });

export const setDynamic = (sheet: Sheet, at: Cursor, dynamic: Dynamic | null): EditResult =>
  editEvent(sheet, at, (e) => { const out = { ...e }; if (dynamic) out.dynamic = dynamic; else delete out.dynamic; return out; });

export const setChordSymbol = (sheet: Sheet, at: Cursor, symbol: string): EditResult =>
  editEvent(sheet, at, (e) => { const out = { ...e }; const s = symbol.trim(); if (s) out.chordSymbol = s.slice(0, 24); else delete out.chordSymbol; return out; });

/** Finger numbers for the notes of the event, lowest note first ("1 3 5"). */
export const setFingering = (sheet: Sheet, at: Cursor, text: string): EditResult =>
  editEvent(sheet, at, (e) => {
    if (e.kind !== 'note' || !e.pitches?.length || e.pitches.some(isDrum)) return null;
    const fingers = text.trim().split(/[\s,]+/).filter(Boolean);
    return { ...e, pitches: (e.pitches as NotePitch[]).map((p, i) => { const out = { ...p }; if (fingers[i]) out.fingering = fingers[i]!.slice(0, 3); else delete out.fingering; return out; }) };
  });

/** Adds or removes the dot of the value under the cursor (not on sixteenths or triplets). */
export const toggleDot = (sheet: Sheet, at: Cursor): EditResult => {
  const e = eventAt(sheet, at);
  if (!e || e.kind === 'measureRest' || e.triplet || e.duration === 'sixteenth') return { sheet, cursor: at };
  const next: SheetEvent = { ...e, dots: e.dots ? 0 : 1 };
  if (e.dots) {
    // Shorter: keep the position and leave a rest in the freed part.
    const result = placeEvent(sheet, at, next);
    return { ...result, cursor: result.placed ?? at };
  }
  const result = placeEvent(sheet, at, next);
  return { ...result, cursor: result.placed ?? at };
};

/** Ties the note under `at` to a new note with the same pitches and the given value, right after it. */
export const tieForward = (sheet: Sheet, at: Cursor, value: Pick<SheetEvent, 'duration' | 'dots' | 'triplet'>): EditResult => {
  const e = eventAt(sheet, at);
  if (!e || e.kind !== 'note') return { sheet, cursor: at, error: 'Escolha uma nota para ligar.' };
  const ticks = eventTicks(e, sheet);
  const events = sheet.staves[at.staff]!.measures[at.measure]!.events;
  const after = starts(events, sheet)[at.event]! + ticks;
  const next = cursorAfter(clone(sheet), at.staff, at.measure, after);
  const withNext = clone(sheet);
  ensureMeasure(withNext, next.measure);
  const placed = placeEvent(withNext, next, { kind: 'note', duration: value.duration, dots: value.dots, ...(value.triplet ? { triplet: true as const } : {}), pitches: structuredClone(e.pitches) });
  if (placed.error) return placed;
  const result = clone(placed.sheet);
  const origin = result.staves[at.staff]!.measures[at.measure]!.events[at.event];
  if (origin) origin.tieToNext = true;
  return { ...placed, sheet: normalize(result) };
};

export const addMeasures = (input: Sheet, count: number, after?: number): Sheet => {
  const sheet = clone(input);
  for (const staff of sheet.staves) staff.measures.splice((after ?? staff.measures.length - 1) + 1, 0, ...Array.from({ length: count }, emptyMeasure));
  return touch(sheet);
};

export const removeMeasure = (input: Sheet, index: number): Sheet => {
  if (input.staves[0]!.measures.length <= 1) return input;
  const sheet = clone(input);
  for (const staff of sheet.staves) staff.measures.splice(index, 1);
  return normalize(touch(sheet));
};

/** Moves the cursor one event left/right, across measures. */
export const stepCursor = (sheet: Sheet, at: Cursor, direction: 1 | -1): Cursor => {
  const staff = sheet.staves[at.staff]!;
  const events = staff.measures[at.measure]!.events;
  if (direction > 0) {
    if (at.event + 1 < events.length) return { ...at, event: at.event + 1 };
    if (at.measure + 1 < staff.measures.length) return { ...at, measure: at.measure + 1, event: 0 };
    return at;
  }
  if (at.event > 0) return { ...at, event: at.event - 1 };
  if (at.measure > 0) return { ...at, measure: at.measure - 1, event: staff.measures[at.measure - 1]!.events.length - 1 };
  return at;
};

/** Same measure on the other staff of a piano score. */
export const switchStaff = (sheet: Sheet, at: Cursor): Cursor => {
  if (sheet.staves.length < 2) return at;
  const staff = at.staff === 0 ? 1 : 0;
  return { staff, measure: at.measure, event: 0 };
};

/** Linear index of an event in the whole staff (used to match drawn beats). */
export const clampCursor = (sheet: Sheet, at: Cursor): Cursor => {
  const staff = Math.min(at.staff, sheet.staves.length - 1);
  const measures = sheet.staves[staff]!.measures;
  const measure = Math.min(at.measure, measures.length - 1);
  return { staff, measure, event: Math.min(at.event, measures[measure]!.events.length - 1) };
};
