const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PC: Record<string, number> = Object.fromEntries([...SHARPS.map((n, i) => [n, i]), ...FLATS.map((n, i) => [n, i])]);
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

const shift = (note: string, semitones: number, preferFlats: boolean): string => {
  const pc = PC[note];
  if (pc === undefined) return note;
  const index = (((pc + semitones) % 12) + 12) % 12;
  return (preferFlats ? FLATS : SHARPS)[index]!;
};

export const transposeChord = (chord: string, semitones: number, preferFlats = false): string => {
  const match = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/u.exec(chord.trim());
  if (!match) return chord;
  const [, root, suffix, bass] = match;
  const out = `${shift(root!, semitones, preferFlats)}${suffix}`;
  return bass ? `${out}/${shift(bass, semitones, preferFlats)}` : out;
};

export const prefersFlats = (key: string): boolean => FLAT_KEYS.has(key.trim());

export const transposeKey = (key: string, semitones: number): string => {
  const match = /^([A-G][#b]?)(m?)$/u.exec(key.trim());
  if (!match) return key;
  const [, root, minor] = match;
  const sharp = `${shift(root!, semitones, false)}${minor}`;
  const flat = `${shift(root!, semitones, true)}${minor}`;
  return prefersFlats(flat) ? flat : sharp;
};
