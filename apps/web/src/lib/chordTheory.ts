/** Chord types offered in the chord library and the study section (Brazilian names). */
export const CHORD_TYPES: { suffix: string; name: string; intervals: number[]; about: string }[] = [
  { suffix: '', name: 'Maior', intervals: [0, 4, 7], about: 'Tônica, terça maior e quinta justa. Som claro e estável.' },
  { suffix: 'm', name: 'Menor', intervals: [0, 3, 7], about: 'Tônica, terça menor e quinta justa. Som mais escuro ou triste.' },
  { suffix: '7', name: 'Sétima (dominante)', intervals: [0, 4, 7, 10], about: 'Acorde maior com sétima menor. Pede resolução: é o V grau do tom.' },
  { suffix: '7M', name: 'Sétima maior', intervals: [0, 4, 7, 11], about: 'Acorde maior com sétima maior. Som suave, comum na MPB e no louvor.' },
  { suffix: 'm7', name: 'Menor com sétima', intervals: [0, 3, 7, 10], about: 'Acorde menor com sétima menor. Os graus ii, iii e vi do campo maior.' },
  { suffix: '6', name: 'Sexta', intervals: [0, 4, 7, 9], about: 'Acorde maior com a sexta maior somada.' },
  { suffix: 'm6', name: 'Menor com sexta', intervals: [0, 3, 7, 9], about: 'Acorde menor com a sexta maior somada.' },
  { suffix: '9', name: 'Nona (add9)', intervals: [0, 4, 7, 14], about: 'Acorde maior com a nona somada, sem sétima. Muito usado no louvor.' },
  { suffix: '7(9)', name: 'Sétima e nona', intervals: [0, 4, 7, 10, 14], about: 'Dominante com nona: mais cor que o 7 simples.' },
  { suffix: 'm7(9)', name: 'Menor com sétima e nona', intervals: [0, 3, 7, 10, 14], about: 'Menor com sétima e nona: som aberto e moderno.' },
  { suffix: '7M(9)', name: 'Sétima maior e nona', intervals: [0, 4, 7, 11, 14], about: 'Sétima maior com nona: bem suave.' },
  { suffix: 'sus2', name: 'Suspenso de segunda', intervals: [0, 2, 7], about: 'A terça vira segunda: nem maior nem menor.' },
  { suffix: 'sus4', name: 'Suspenso de quarta', intervals: [0, 5, 7], about: 'A terça vira quarta. Costuma resolver no acorde maior.' },
  { suffix: '°', name: 'Diminuto', intervals: [0, 3, 6], about: 'Terça menor e quinta diminuta. Tenso, liga um acorde a outro.' },
  { suffix: '°7', name: 'Diminuto com sétima', intervals: [0, 3, 6, 9], about: 'Empilha terças menores: muito usado como passagem.' },
  { suffix: 'm7(b5)', name: 'Meio-diminuto', intervals: [0, 3, 6, 10], about: 'Menor com quinta diminuta e sétima menor. O vii grau do campo maior.' },
  { suffix: '+', name: 'Aumentado', intervals: [0, 4, 8], about: 'Terça maior e quinta aumentada. Som de suspense.' },
  { suffix: 'm(7M)', name: 'Menor com sétima maior', intervals: [0, 3, 7, 11], about: 'Menor com sétima maior: cor de mistério.' },
];

export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SOLFEGE: Record<string, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };

const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export const pcOf = (note: string): number => PC[note] ?? 0;

const INTERVAL: Record<number, string> = { 0: '1', 2: '2M', 3: '3m', 4: '3M', 5: '4J', 6: '5b', 7: '5J', 8: '5#', 9: '6M', 10: '7m', 11: '7M', 14: '9M' };
export const INTERVAL_NAMES: Record<string, string> = {
  '1': 'tônica',
  '2M': 'segunda maior',
  '3m': 'terça menor',
  '3M': 'terça maior',
  '4J': 'quarta justa',
  '5b': 'quinta diminuta',
  '5J': 'quinta justa',
  '5#': 'quinta aumentada',
  '6M': 'sexta maior',
  '7m': 'sétima menor',
  '7M': 'sétima maior',
  '9M': 'nona maior',
};

/** Major keys written with flats; a minor key is spelled like its relative major. */
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]);
const flatKey = (rootPc: number, minor: boolean) => FLAT_MAJOR.has(minor ? (rootPc + 3) % 12 : rootPc);

/** Each letter once: the n-th note of a seven-note scale takes the n-th letter after the root's. */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const spellDiatonic = (root: string, pcs: number[]): string[] => {
  const start = LETTERS.indexOf(root[0]!);
  return pcs.map((pc, i) => {
    const letter = LETTERS[(start + i) % 7]!;
    const diff = ((((pc - PC[letter]!) % 12) + 18) % 12) - 6;
    return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
  });
};

export const chordFormation = (root: string, suffix: string): { name: string; notes: string[]; intervals: string[] } => {
  const type = CHORD_TYPES.find((t) => t.suffix === suffix) ?? CHORD_TYPES[0]!;
  const rootPc = pcOf(root);
  const minor = type.intervals.includes(3);
  const names = root.includes('b') || (!root.includes('#') && flatKey(rootPc, minor)) ? FLAT : SHARP;
  return {
    name: `${root}${suffix}`,
    notes: type.intervals.map((i) => (i === 0 ? root : names[(rootPc + i) % 12]!)),
    intervals: type.intervals.map((i) => INTERVAL[i] ?? String(i)),
  };
};

export type ScaleKind = 'major' | 'minor' | 'harmonicMinor' | 'majorPentatonic' | 'minorPentatonic' | 'blues';
export const SCALES: Record<ScaleKind, { name: string; steps: number[]; about: string }> = {
  major: { name: 'Maior', steps: [0, 2, 4, 5, 7, 9, 11], about: 'Tom, tom, semitom, tom, tom, tom, semitom. A base do campo harmônico maior.' },
  minor: { name: 'Menor natural', steps: [0, 2, 3, 5, 7, 8, 10], about: 'As mesmas notas da relativa maior, começando no sexto grau dela.' },
  harmonicMinor: { name: 'Menor harmônica', steps: [0, 2, 3, 5, 7, 8, 11], about: 'Menor com a sétima elevada: dá o acorde dominante (V7) no tom menor.' },
  majorPentatonic: { name: 'Pentatônica maior', steps: [0, 2, 4, 7, 9], about: 'Cinco notas, sem semitons: a mais usada para improvisar e fazer solos.' },
  minorPentatonic: { name: 'Pentatônica menor', steps: [0, 3, 5, 7, 10], about: 'Cinco notas da escala menor. Base de muitos solos.' },
  blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10], about: 'Pentatônica menor com a "blue note" (quinta diminuta).' },
};

export const scaleNotes = (root: string, kind: ScaleKind): string[] => {
  const steps = SCALES[kind].steps;
  const rootPc = pcOf(root);
  const pcs = steps.map((s) => (rootPc + s) % 12);
  if (steps.length === 7) return spellDiatonic(root, pcs);
  const names = root.includes('b') || flatKey(rootPc, kind !== 'majorPentatonic') ? FLAT : SHARP;
  return pcs.map((pc, i) => (i === 0 ? root : names[pc]!));
};

const MAJOR_FIELD = [
  ['I', '', '7M'],
  ['ii', 'm', 'm7'],
  ['iii', 'm', 'm7'],
  ['IV', '', '7M'],
  ['V', '', '7'],
  ['vi', 'm', 'm7'],
  ['vii°', '°', 'm7(b5)'],
] as const;
const MINOR_FIELD = [
  ['i', 'm', 'm7'],
  ['ii°', '°', 'm7(b5)'],
  ['III', '', '7M'],
  ['iv', 'm', 'm7'],
  ['v', 'm', 'm7'],
  ['VI', '', '7M'],
  ['VII', '', '7'],
] as const;

/** The seven chords built on each degree of the key (triads and four-note chords). */
export const harmonicField = (root: string, mode: 'major' | 'minor'): { roman: string; triad: string; tetrad: string; note: string }[] => {
  const notes = scaleNotes(root, mode);
  return (mode === 'major' ? MAJOR_FIELD : MINOR_FIELD).map(([roman, t3, t4], i) => ({ roman, note: notes[i]!, triad: `${notes[i]}${t3}`, tetrad: `${notes[i]}${t4}` }));
};
