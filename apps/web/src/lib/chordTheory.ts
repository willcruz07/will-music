/** Chord types offered in the chord library and the study section (Brazilian names). */
export const CHORD_TYPES: { suffix: string; name: string; intervals: number[]; about: string }[] = [
  { suffix: '', name: 'Maior', intervals: [0, 4, 7], about: 'Tônica, terça maior e quinta justa. Som claro e estável.' },
  { suffix: 'm', name: 'Menor', intervals: [0, 3, 7], about: 'Fundamental, terça menor e quinta justa. A terça menor define sua qualidade; o caráter expressivo depende do ritmo, do timbre e do contexto.' },
  { suffix: '7', name: 'Sétima (dominante)', intervals: [0, 4, 7, 10], about: 'Acorde maior com sétima menor. Pode atuar como V grau, preparando a resolução uma quinta abaixo, mas também aparece em blues e em contextos não funcionais.' },
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
  { suffix: 'm(b5)', name: 'Tríade diminuta', intervals: [0, 3, 6], about: 'Tônica, terça menor e quinta diminuta: as mesmas notas da tríade °. Com a sétima menor vira m7(b5), o acorde meio-diminuto.' },
  { suffix: 'm7(b5)', name: 'Meio-diminuto', intervals: [0, 3, 6, 10], about: 'Menor com quinta diminuta e sétima menor. O vii grau do campo maior.' },
  { suffix: '+', name: 'Aumentado', intervals: [0, 4, 8], about: 'Terça maior e quinta aumentada. Som de suspense.' },
  { suffix: 'm(7M)', name: 'Menor com sétima maior', intervals: [0, 3, 7, 11], about: 'Menor com sétima maior: cor de mistério.' },
  { suffix: '5', name: 'Power chord', intervals: [0, 7], about: 'Fundamental e quinta, sem terça. Não define maior ou menor; comum em riffs de rock e guitarra com distorção.' },
  { suffix: '11', name: 'Décima primeira adicionada', intervals: [0, 4, 7, 17], about: 'Neste app, 11 isolado adiciona a 11ª justa à tríade, sem sétima implícita. Para a estrutura dominante estendida, escolha 7(9,11). A 11ª pode criar atrito com a terça maior.' },
  { suffix: '13', name: 'Décima terceira adicionada', intervals: [0, 4, 7, 21], about: 'Neste app, 13 isolado adiciona a 13ª maior à tríade, sem sétima implícita. Para dominante, escolha 7(13) ou 7(9,11,13). Tem as mesmas classes de altura do acorde 6.' },
  { suffix: 'm(9)', name: 'Menor com nona adicionada', intervals: [0, 3, 7, 14], about: 'Tríade menor com nona maior, sem sétima. A nona acrescenta uma cor aberta sem mudar a terça menor.' },
  { suffix: '6(9)', name: 'Sexta e nona', intervals: [0, 4, 7, 9, 14], about: 'Tríade maior com sexta e nona, sem sétima. Usado como repouso na bossa nova, no jazz e na MPB.' },
  { suffix: 'm6(9)', name: 'Menor com sexta e nona', intervals: [0, 3, 7, 9, 14], about: 'Tríade menor com sexta maior e nona maior. Uma cor de tônica menor frequente no jazz e na bossa nova.' },
  { suffix: '7sus4', name: 'Sétima com quarta suspensa', intervals: [0, 5, 7, 10], about: 'A quarta substitui a terça e a sétima é menor. Pode preparar o acorde 7 ao descer a quarta para a terça, ou permanecer suspenso.' },
  { suffix: '7sus2', name: 'Sétima com segunda suspensa', intervals: [0, 2, 7, 10], about: 'Segunda maior no lugar da terça, com sétima menor. Diferente do 7(9), não inclui a terça maior.' },
  { suffix: '7(13)', name: 'Dominante com décima terceira', intervals: [0, 4, 7, 10, 21], about: 'Dominante com 13ª maior. Nesta fórmula a nona e a décima primeira não são acrescentadas automaticamente. A terça e a sétima sustentam a função dominante.' },
  { suffix: '7(b9)', name: 'Dominante com nona menor', intervals: [0, 4, 7, 10, 13], about: 'A nona menor fica meio tom acima da fundamental e intensifica a tensão. Frequente na preparação de acordes menores.' },
  { suffix: '7(#9)', name: 'Dominante com nona aumentada', intervals: [0, 4, 7, 10, 15], about: 'Combina terça maior e nona aumentada, com a altura da terça menor. Cor frequente no blues, no rock e no jazz; a grafia #9 indica sua função de extensão.' },
  { suffix: '7(b5)', name: 'Dominante com quinta diminuta', intervals: [0, 4, 6, 10], about: 'A quinta justa é substituída pela quinta diminuta. Mantém terça maior e sétima menor, com uma tensão alterada.' },
  { suffix: '7(#5)', name: 'Dominante com quinta aumentada', intervals: [0, 4, 8, 10], about: 'A quinta é elevada meio tom. Pode conduzir por semitom a uma nota do acorde seguinte; também é escrito +7 ou aug7.' },
  { suffix: '7(b13)', name: 'Dominante com décima terceira menor', intervals: [0, 4, 7, 10, 20], about: 'Acrescenta 13ª menor ao dominante. Tem a mesma altura da quinta aumentada, mas representa outra extensão e pode coexistir com a quinta justa.' },
  { suffix: '7(#11)', name: 'Dominante com décima primeira aumentada', intervals: [0, 4, 7, 10, 18], about: 'A #11 fica um trítono acima da fundamental. É uma cor do lídio dominante e dos substitutos de trítono; não substitui automaticamente a quinta.' },
  { suffix: '7(9,13)', name: 'Dominante com nona e décima terceira', intervals: [0, 4, 7, 10, 14, 21], about: 'Nona e 13ª maiores sobre um dominante. Em formações práticas a quinta pode ser omitida para acomodar as extensões.' },
  { suffix: '7(b9,b13)', name: 'Dominante com nona e décima terceira menores', intervals: [0, 4, 7, 10, 13, 20], about: 'Duas extensões alteradas sobre a estrutura dominante. Produz forte tensão e aparece com frequência em resoluções para o modo menor.' },
  { suffix: '7(9,11)', name: 'Dominante com nona e décima primeira', intervals: [0, 4, 7, 10, 14, 17], about: 'Inclui sétima menor, nona e 11ª justa. A terça e a 11ª podem produzir atrito; isso o diferencia do suspenso, que substitui a terça.' },
  { suffix: '7(9,11,13)', name: 'Dominante com nona, décima primeira e décima terceira', intervals: [0, 4, 7, 10, 14, 17, 21], about: 'Estrutura estendida completa do dominante. Reúne sete notas; instrumentos com poucas cordas podem não comportar a fórmula integral.' },
  { suffix: 'm7(11)', name: 'Menor com sétima e décima primeira', intervals: [0, 3, 7, 10, 17], about: 'A 11ª justa amplia o acorde menor com sétima. Cor comum em acompanhamentos modais e no jazz.' },
  { suffix: 'm7(9,11)', name: 'Menor com nona e décima primeira', intervals: [0, 3, 7, 10, 14, 17], about: 'Tétrade menor com nona maior e 11ª justa. Também aparece como m11 em notação internacional.' },
  { suffix: 'm7(9,11,13)', name: 'Menor com nona, décima primeira e décima terceira', intervals: [0, 3, 7, 10, 14, 17, 21], about: 'Estrutura menor estendida com 13ª maior, associada à cor dórica. A execução completa exige sete notas distintas.' },
  { suffix: '7M(#5)', name: 'Sétima maior com quinta aumentada', intervals: [0, 4, 8, 11], about: 'Tríade aumentada com sétima maior. Uma sonoridade de harmonia não funcional e da menor melódica.' },
  { suffix: '7M(#11)', name: 'Sétima maior com décima primeira aumentada', intervals: [0, 4, 7, 11, 18], about: 'A #11 dá a cor lídia ao acorde maior com sétima maior, evitando a 11ª justa junto à terça.' },
  { suffix: '7M(9,11,13)', name: 'Sétima maior com nona, décima primeira e décima terceira', intervals: [0, 4, 7, 11, 14, 17, 21], about: 'Estrutura maior estendida completa, incluindo 11ª justa. Pode apresentar atrito entre terça e 11ª; não é a mesma fórmula de um acorde com #11.' },
];

export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SOLFEGE: Record<string, string> = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };

const NATURAL: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Pitch class of a note name with any number of sharps or flats (E#, Cb, Bbb…). */
export const pcOf = (note: string): number => {
  const m = /^([A-G])([#b]*)$/u.exec(note);
  if (!m) return 0;
  const shift = [...m[2]!].reduce((n, c) => n + (c === '#' ? 1 : -1), 0);
  return (((NATURAL[m[1]!]! + shift) % 12) + 12) % 12;
};

const INTERVAL: Record<number, string> = { 0: '1', 2: '2M', 3: '3m', 4: '3M', 5: '4J', 6: '5b', 7: '5J', 8: '5#', 9: '6M', 10: '7m', 11: '7M', 13: '9m', 14: '9M', 15: '9#', 17: '11J', 18: '11#', 20: '13m', 21: '13M' };
/** Letter steps from the root for each interval: a third is always two letters up, a seventh six, and so on. */
const STEPS: Record<number, number> = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5, 10: 6, 11: 6, 13: 1, 14: 1, 15: 1, 17: 3, 18: 3, 20: 5, 21: 5 };

/** The note some semitones above the root, a given number of letters away (a minor third of G is Bb, not A#). */
export const spellNote = (root: string, semitones: number, steps: number): string => {
  const letter = LETTERS[(LETTERS.indexOf(root[0]!) + steps) % 7]!;
  const target = (pcOf(root) + semitones) % 12;
  const diff = ((((target - NATURAL[letter]!) % 12) + 18) % 12) - 6;
  return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
};

/** Spells chord tones given in semitones above the root; in a diminished seventh chord, 9 is a seventh. */
export const spellChordTones = (root: string, intervals: readonly number[], diminishedSeventh = false): string[] =>
  intervals.map((i) => spellNote(root, i, diminishedSeventh && i === 9 ? 6 : (STEPS[i] ?? Math.round((i * 7) / 12))));

export const INTERVAL_NAMES: Record<string, string> = {
  '1': 'tônica',
  '7°': 'sétima diminuta',
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
  '9m': 'nona menor',
  '9#': 'nona aumentada',
  '11J': 'décima primeira justa',
  '11#': 'décima primeira aumentada',
  '13m': 'décima terceira menor',
  '13M': 'décima terceira maior',
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
    const diff = ((((pc - NATURAL[letter]!) % 12) + 18) % 12) - 6;
    return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
  });
};

export const chordFormation = (root: string, suffix: string): { name: string; notes: string[]; intervals: string[] } => {
  const type = CHORD_TYPES.find((t) => t.suffix === suffix) ?? CHORD_TYPES[0]!;
  const dim7 = type.suffix === '°7';
  return {
    name: `${root}${suffix}`,
    notes: spellChordTones(root, type.intervals, dim7),
    intervals: type.intervals.map((i) => (dim7 && i === 9 ? '7°' : (INTERVAL[i] ?? String(i)))),
  };
};

export type ModalKind = 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian';
export type ScaleKind = 'major' | 'minor' | 'harmonicMinor' | ModalKind | 'majorPentatonic' | 'minorPentatonic' | 'blues';
export const SCALES: Record<ScaleKind, { name: string; steps: number[]; about: string }> = {
  major: { name: 'Maior', steps: [0, 2, 4, 5, 7, 9, 11], about: 'Tom, tom, semitom, tom, tom, tom, semitom. A base do campo harmônico maior.' },
  minor: { name: 'Menor natural', steps: [0, 2, 3, 5, 7, 8, 10], about: 'As mesmas notas da relativa maior, começando no sexto grau dela.' },
  harmonicMinor: { name: 'Menor harmônica', steps: [0, 2, 3, 5, 7, 8, 11], about: 'Menor com a sétima elevada: dá o acorde dominante (V7) no tom menor.' },
  dorian: { name: 'Dórico', steps: [0, 2, 3, 5, 7, 9, 10], about: 'Modo menor com sexta maior (1 2 b3 4 5 6 b7). O IV maior destaca sua cor; exemplo em Dó: Cm e F.' },
  phrygian: { name: 'Frígio', steps: [0, 1, 3, 5, 7, 8, 10], about: 'Modo menor com segunda menor (1 b2 b3 4 5 b6 b7). O bII maior e seu movimento para o i ressaltam essa sonoridade.' },
  lydian: { name: 'Lídio', steps: [0, 2, 4, 6, 7, 9, 11], about: 'Modo maior com quarta aumentada (1 2 3 #4 5 6 7). O II maior e a #11 sobre o acorde de centro evidenciam sua cor.' },
  mixolydian: { name: 'Mixolídio', steps: [0, 2, 4, 5, 7, 9, 10], about: 'Modo maior com sétima menor (1 2 3 4 5 6 b7). O bVII maior é característico; o I7 pode ser centro modal, sem obrigação de resolver como dominante.' },
  locrian: { name: 'Lócrio', steps: [0, 1, 3, 5, 6, 8, 10], about: 'Modo com segunda menor e quinta diminuta (1 b2 b3 4 b5 b6 b7). Sua tétrade inicial é meio-diminuta; sustentar esse centro exige cuidado, pois ele tem pouca estabilidade tonal.' },
  majorPentatonic: { name: 'Pentatônica maior', steps: [0, 2, 4, 7, 9], about: 'Cinco notas, sem semitons: a mais usada para improvisar e fazer solos.' },
  minorPentatonic: { name: 'Pentatônica menor', steps: [0, 3, 5, 7, 10], about: 'Cinco notas da escala menor. Base de muitos solos.' },
  blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10], about: 'Pentatônica menor com a "blue note" (quinta diminuta).' },
};

/** Scale degree (letters above the root) of each note of the gapped scales: 1 2 3 5 6, 1 b3 4 5 b7, 1 b3 4 b5 5 b7. */
const GAPPED_DEGREES: Partial<Record<ScaleKind, number[]>> = {
  majorPentatonic: [0, 1, 2, 4, 5],
  minorPentatonic: [0, 2, 3, 4, 6],
  blues: [0, 2, 3, 4, 4, 6],
};

/** Keys offered for scales: sharp and flat names, so G#m and D#m are there as well as Ab and Eb. */
export const KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

export const scaleNotes = (root: string, kind: ScaleKind): string[] => {
  const steps = SCALES[kind].steps;
  if (steps.length === 7) return spellDiatonic(root, steps.map((s) => (pcOf(root) + s) % 12));
  // The other scales are spelled by degree too, so the blue note of E is Bb (a flat fifth), not A#.
  const degrees = GAPPED_DEGREES[kind]!;
  return steps.map((s, i) => spellNote(root, s, degrees[i]!));
};

const MAJOR_FIELD = [
  ['I', '', '7M'],
  ['ii', 'm', 'm7'],
  ['iii', 'm', 'm7'],
  ['IV', '', '7M'],
  ['V', '', '7'],
  ['vi', 'm', 'm7'],
  // The seventh degree of the major key is half-diminished: Bm(b5), and with its seventh Bm7(b5).
  ['viiø', 'm(b5)', 'm7(b5)'],
] as const;
const MINOR_FIELD = [
  ['i', 'm', 'm7'],
  ['iiø', 'm(b5)', 'm7(b5)'],
  ['III', '', '7M'],
  ['iv', 'm', 'm7'],
  ['v', 'm', 'm7'],
  ['VI', '', '7M'],
  ['VII', '', '7'],
] as const;

/** Harmonic minor: the raised seventh makes V major (the V7 that leads home) and vii a full diminished (vii°7). */
const HARMONIC_MINOR_FIELD = [
  ['i', 'm', 'm(7M)'],
  ['iiø', 'm(b5)', 'm7(b5)'],
  ['III+', '+', '7M(#5)'],
  ['iv', 'm', 'm7'],
  ['V', '', '7'],
  ['VI', '', '7M'],
  ['vii°', '°', '°7'],
] as const;

export type FieldMode = 'major' | 'minor' | 'harmonicMinor' | ModalKind;

/**
 * Roman numeral of the four-note chord: the triad's numeral plus its seventh. The vii of the major key (and
 * the ii of the minor) is half-diminished: viiø, Bm(b5), and viiø7, Bm7(b5) — not the diminished seventh (°7).
 */
const tetradNumeral = (roman: string, t4: string): string => {
  const base = roman.replace(/[°+ø]$/u, '');
  if (t4 === 'm7(b5)') return `${base}ø7`;
  if (t4 === '°7') return `${base}°7`;
  if (t4 === '7M' || t4 === '7M(#5)') return `${base}${t4 === '7M(#5)' ? '+' : ''}7M`;
  if (t4 === 'm(7M)') return `${base}(7M)`;
  return `${base}7`;
};

/** The seven chords built on each degree of the key (triads and four-note chords, each with its numeral). */
export const harmonicField = (root: string, mode: FieldMode): { roman: string; tetradRoman: string; triad: string; tetrad: string; note: string }[] => {
  const notes = scaleNotes(root, mode);
  if (mode !== 'major' && mode !== 'minor' && mode !== 'harmonicMinor') {
    const steps = SCALES[mode].steps;
    const major = SCALES.major.steps;
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    return steps.map((step, index) => {
      const interval = (offset: number) => (steps[(index + offset) % 7]! - step + 12) % 12;
      const third = interval(2), fifth = interval(4), seventh = interval(6);
      const t3 = fifth === 6 ? 'm(b5)' : fifth === 8 ? '+' : third === 3 ? 'm' : '';
      const t4 = fifth === 6 ? seventh === 9 ? '°7' : 'm7(b5)' : third === 3 ? seventh === 11 ? 'm(7M)' : 'm7' : seventh === 11 ? '7M' : '7';
      const numeral = third === 3 ? numerals[index]!.toLowerCase() : numerals[index]!;
      const alteration = step - major[index]!;
      const roman = `${alteration < 0 ? 'b' : alteration > 0 ? '#' : ''}${numeral}${fifth === 6 ? '°' : fifth === 8 ? '+' : ''}`;
      return { roman, tetradRoman: tetradNumeral(roman, t4), note: notes[index]!, triad: `${notes[index]}${t3}`, tetrad: `${notes[index]}${t4}` };
    });
  }
  const field = mode === 'major' ? MAJOR_FIELD : mode === 'minor' ? MINOR_FIELD : HARMONIC_MINOR_FIELD;
  return field.map(([roman, t3, t4], i) => ({ roman, tetradRoman: tetradNumeral(roman, t4), note: notes[i]!, triad: `${notes[i]}${t3}`, tetrad: `${notes[i]}${t4}` }));
};
