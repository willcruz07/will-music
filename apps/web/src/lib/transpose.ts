const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC: Record<string, number> = Object.fromEntries([...SHARPS.map((n, i) => [n, i]), ...FLATS.map((n, i) => [n, i])]);

// Usual names in Brazilian charts, by pitch class.
const MAJOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
// Keys whose signature uses flats.
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
// Borrowed chords in a major key that are written with flats even in sharp keys: bIII, bVI, bVII.
const FLAT_DEGREES_IN_MAJOR = new Set([3, 8, 10]);

const mod12 = (n: number) => ((n % 12) + 12) % 12;

const parseKey = (key: string): { pc: number; minor: boolean } | null => {
  const match = /^([A-G][#b]?)(m?)$/u.exec(key.trim());
  const pc = match ? PC[match[1]!] : undefined;
  return pc === undefined ? null : { pc, minor: match![2] === 'm' };
};

export const prefersFlats = (key: string): boolean => FLAT_KEYS.has(key.trim());

/** Spelling (sharp or flat) of a pitch class inside a key; a boolean forces flats/sharps. */
const spell = (pc: number, key: string | boolean): string => {
  if (typeof key === 'boolean') return (key ? FLATS : SHARPS)[pc]!;
  const parsed = parseKey(key);
  if (!parsed) return SHARPS[pc]!;
  const flats = prefersFlats(key) || (!parsed.minor && FLAT_DEGREES_IN_MAJOR.has(mod12(pc - parsed.pc)));
  return (flats ? FLATS : SHARPS)[pc]!;
};

/**
 * Transposes root and bass, keeping the suffix. `key` is the destination key (spelling follows it),
 * or a boolean to force flats (true) or sharps (false).
 */
export const transposeChord = (chord: string, semitones: number, key: string | boolean = false): string => {
  const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/u.exec(chord.trim());
  if (!match) return chord;
  const [, root, suffix, bass] = match;
  const move = (note: string) => {
    const pc = PC[note];
    return pc === undefined ? note : spell(mod12(pc + semitones), key);
  };
  const out = `${move(root!)}${suffix}`;
  return bass ? `${out}/${move(bass)}` : out;
};

export const transposeKey = (key: string, semitones: number): string => {
  const parsed = parseKey(key);
  if (!parsed) return key;
  return (parsed.minor ? MINOR_KEYS : MAJOR_KEYS)[mod12(parsed.pc + semitones)]!;
};
