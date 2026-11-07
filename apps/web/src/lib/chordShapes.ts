export type GuitarShape = { frets: number[]; fingers: number[]; baseFret: number; barres: number[] };

const ROOT_KEY: Record<string, string> = {
  C: 'C', 'C#': 'Csharp', Db: 'Csharp', D: 'D', 'D#': 'Eb', Eb: 'Eb', E: 'E', F: 'F', 'F#': 'Fsharp', Gb: 'Fsharp',
  G: 'G', 'G#': 'Ab', Ab: 'Ab', A: 'A', 'A#': 'Bb', Bb: 'Bb', B: 'B',
};
// Bass names as chords-db spells them in slash suffixes.
const BASS_NAME: Record<string, string> = {
  C: 'C', 'C#': 'C#', Db: 'C#', D: 'D', 'D#': 'D#', Eb: 'D#', E: 'E', F: 'F', 'F#': 'F#', Gb: 'F#', G: 'G', 'G#': 'G#', Ab: 'G#', A: 'A', 'A#': 'Bb', Bb: 'Bb', B: 'B',
};
// Brazilian suffix → chords-db suffix.
const SUFFIX: Record<string, string> = {
  '': 'major', m: 'minor', '7': '7', '7M': 'maj7', maj7: 'maj7', m7: 'm7', 'm7(b5)': 'm7b5', m7b5: 'm7b5', ø: 'm7b5',
  '°': 'dim', º: 'dim', dim: 'dim', '°7': 'dim7', º7: 'dim7', dim7: 'dim7', '+': 'aug', aug: 'aug',
  '2': 'sus2', sus2: 'sus2', '4': 'sus4', sus4: 'sus4', sus: 'sus4', '6': '6', m6: 'm6', '9': 'add9', add9: 'add9',
  '7(9)': '9', m9: 'm9', 'm7(9)': 'm9', 'm(9)': 'madd9', madd9: 'madd9', '7M(9)': 'maj9', '11': '11', '13': '13',
  '7(13)': '13', '7(b9)': '7b9', '7(#9)': '7#9', 'm(7M)': 'mmaj7', mmaj7: 'mmaj7', '7(4)': '7sus4', '74': '7sus4',
  '7sus4': '7sus4', '6(9)': '69', '69': '69', 'm6(9)': 'm69', '7(b5)': '7b5', '7(#5)': 'aug7', '7M(#5)': 'maj7#5',
};

export const dbKeyFor = (chord: string): { key: string; suffix: string; fallback?: string } | null => {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/u.exec(chord.trim());
  if (!m) return null;
  const key = ROOT_KEY[m[1]!];
  const suffix = SUFFIX[m[2]!];
  if (!key || !suffix) return null;
  if (!m[3]) return { key, suffix };
  const bass = BASS_NAME[m[3]];
  if (!bass) return null;
  if (suffix === 'major') return { key, suffix: `/${bass}` };
  if (suffix === 'minor') return { key, suffix: `m/${bass}` };
  return { key, suffix, fallback: suffix };
};

type GuitarDb = { chords: Record<string, { suffix: string; positions: GuitarShape[] }[]> };
let guitarDb: Promise<GuitarDb> | undefined;
const loadGuitarDb = () => (guitarDb ??= import('@tombatossals/chords-db/lib/guitar.json').then((m) => (m.default ?? m) as unknown as GuitarDb));

/** Every guitar position chords-db has for a chord (a missing slash shape falls back to the chord without bass). */
export const guitarShapes = async (chord: string): Promise<GuitarShape[]> => {
  const target = dbKeyFor(chord);
  if (!target) return [];
  const db = await loadGuitarDb();
  const list = db.chords[target.key]?.find((c) => c.suffix === target.suffix)?.positions ?? [];
  if (list.length) return list.map((p) => ({ frets: p.frets, fingers: p.fingers, baseFret: p.baseFret, barres: p.barres }));
  if (target.suffix.startsWith('/') || target.suffix.startsWith('m/')) return guitarShapes(chord.replace(/\/.*$/u, ''));
  return [];
};

/** First guitar position for a chord; a missing slash shape falls back to the chord without bass. */
export const guitarShape = async (chord: string): Promise<GuitarShape | null> => {
  const target = dbKeyFor(chord);
  if (!target) return null;
  const db = await loadGuitarDb();
  const find = (suffix: string) => db.chords[target.key]?.find((c) => c.suffix === suffix)?.positions[0] ?? null;
  const shape = find(target.suffix);
  if (shape) return { frets: shape.frets, fingers: shape.fingers, baseFret: shape.baseFret, barres: shape.barres };
  if (target.suffix.startsWith('/') || target.suffix.startsWith('m/')) {
    return guitarShape(chord.replace(/\/.*$/u, ''));
  }
  return null;
};

export type SvguitarChord = {
  fingers: ([number, number | 'x'] | [number, number, string])[];
  barres: { fromString: number; toString: number; fret: number }[];
  position: number;
};

/** chords-db lists strings low E → high E; svguitar numbers them 1 (high E) to 6 (low E). */
export const toSvguitar = (shape: GuitarShape): SvguitarChord => {
  const n = shape.frets.length;
  const fingers: SvguitarChord['fingers'] = shape.frets.map((fret, i) => {
    const string = n - i;
    if (fret < 0) return [string, 'x'];
    if (fret === 0) return [string, 0];
    return [string, fret, shape.fingers[i] ? String(shape.fingers[i]) : ''];
  });
  const barres = shape.barres.map((fret) => {
    const strings = shape.frets.flatMap((f, i) => (f === fret ? [n - i] : []));
    return { fromString: Math.max(...strings), toString: Math.min(...strings), fret };
  });
  return { fingers, barres, position: shape.baseFret };
};
