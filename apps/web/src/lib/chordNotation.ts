import { normalizeChordSuffix, notePitchClass, parseChordToken } from './chordToken.ts';

const notePc = (name: string): number | null => {
  return notePitchClass(name);
};

type Shape = { third: number | null; fifth: number; sixth?: number; seventh?: number; extras: number[] };

const TENSION: Record<string, number> = { b9: 1, '9': 2, '#9': 3, '11': 5, '#11': 6, b13: 8, '13': 9, b5: 6, '#5': 8, '4': 5, '2': 2, '6': 9 };

// Brazilian chord suffixes, matched in order at the start of the remaining text.
const RULES: [RegExp, (s: Shape) => void][] = [
  [/^(?:m7\(b5\)|m7b5|ø)/u, (s) => Object.assign(s, { third: 3, fifth: 6, seventh: 10 })],
  [/^(?:°7|º7|dim7)/u, (s) => Object.assign(s, { third: 3, fifth: 6, seventh: 9 })],
  [/^(?:°|º|dim)/u, (s) => Object.assign(s, { third: 3, fifth: 6 })],
  [/^(?:maj7|7M|7\+|M7)/u, (s) => (s.seventh = 11)],
  [/^m(?!aj)/u, (s) => (s.third = 3)],
  [/^(?:\+|aug)/u, (s) => (s.fifth = 8)],
  [/^(?:sus2|2)/u, (s) => (s.third = 2)],
  [/^(?:sus4|sus|4)/u, (s) => (s.third = 5)],
  [/^5/u, (s) => (s.third = null)],
  [/^6/u, (s) => (s.sixth = 9)],
  [/^13/u, (s) => s.extras.push(9)],
  [/^11/u, (s) => s.extras.push(5)],
  [/^7/u, (s) => (s.seventh = 10)],
  [/^(?:add9|9)/u, (s) => s.extras.push(2)],
];

const parseSuffix = (suffix: string): Shape | null => {
  const shape: Shape = { third: 4, fifth: 7, extras: [] };
  let rest = suffix;
  while (rest) {
    const group = /^\(([^)]*)\)/u.exec(rest);
    if (group) {
      for (const token of group[1]!.split(/[,/\s]+/u).filter(Boolean)) {
        if (token === '7M' || token === 'maj7') shape.seventh = 11;
        else if (token === '7') shape.seventh = 10;
        else if (token === 'b5') shape.fifth = 6;
        else if (token === '#5') shape.fifth = 8;
        else if (TENSION[token] !== undefined) shape.extras.push(TENSION[token]!);
        else return null;
      }
      rest = rest.slice(group[0].length);
      continue;
    }
    const rule = RULES.find(([re]) => re.test(rest));
    if (!rule) return null;
    rule[1](shape);
    rest = rest.slice(rule[0].exec(rest)![0].length);
  }
  return shape;
};

/** Pitch classes of a chord in Brazilian notation: bass first (when it differs), then root, 3rd, 5th, 6th, 7th, tensions. */
export const chordNotes = (chord: string): number[] | null => {
  const parsed = parseChordToken(chord);
  if (!parsed) return null;
  const root = notePc(parsed.root);
  const shape = parseSuffix(normalizeChordSuffix(parsed.suffix));
  if (root === null || !shape) return null;
  const bass = parsed.bass ? notePc(parsed.bass) : null;
  if (parsed.bass && bass === null) return null;
  const intervals = [0, shape.third, shape.fifth, shape.sixth, shape.seventh, ...shape.extras].filter((i): i is number => i !== null && i !== undefined);
  const tones = [...new Set(intervals.map((i) => (root + i) % 12))];
  return bass !== null && bass !== root ? [bass, ...tones.filter((t) => t !== bass)] : tones;
};

export const isKnownChord = (text: string): boolean => chordNotes(text) !== null;
