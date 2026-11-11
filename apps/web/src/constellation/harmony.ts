import { spellPitch } from '../lib/transpose.ts';
import { chordNotes } from '../lib/chordNotation.ts';
import { CHORD_TYPES } from '../lib/chordTheory.ts';

/**
 * The harmony engine of the Constelação de acordes. Harmony moves by tension and resolution: every chord,
 * in its center, is at rest (repouso), moving away (afastamento) or in tension (tensão), and every next
 * step carries both a visual motion and a musical relationship. Similarity is measured separately
 * from function. The reference center remains stable until the musician explicitly adopts another.
 */

export type Quality =
  | ''
  | '6'
  | '7M'
  | '7M(9)'
  | '6(9)'
  | 'm'
  | 'm7'
  | 'm6'
  | 'm7(9)'
  | 'm(7M)'
  | '7'
  | '7(9)'
  | '7(13)'
  | '7(b9)'
  | '7(#5)'
  | '7sus4'
  | 'm7(b5)'
  | '°7' | '°' | '+' | 'm7(11)' | 'm7(9,11)' | 'm6(9)' | '7(#11)' | '7(#9)' | '7(b13)' | '7(9,13)' | '7(b9,b13)' | '7M(#11)' | '7sus4(9)';
/** `root` is a pitch class (0 = C). `flat` forces a flat spelling (tritone subs, borrowed chords). */
export type Chord = { root: number; quality: Quality; flat?: boolean; bass?: number };
export type Center = { root: number; minor: boolean };
export type Group = 'maj' | 'min' | 'dom' | 'hdim' | 'dim' | 'dtri' | 'aug' | 'sus';
export type Level = 'repouso' | 'afastamento' | 'tensao';
export type Motion = 'relaxa' | 'tensiona' | 'resolve';
/** A step: where to, the motion, why it works, the center after it, and the other types of that root (the balloon). */
export type Relation = 'resolucao' | 'preparacao' | 'substituicao' | 'transformacao' | 'notas-comuns' | 'emprestimo' | 'passagem' | 'continuidade';
export const RELATION_NAMES: Record<Relation, string> = { resolucao: 'Resolução local', preparacao: 'Preparação', substituicao: 'Substituição', transformacao: 'Transformação', 'notas-comuns': 'Notas em comum', emprestimo: 'Empréstimo modal', passagem: 'Passagem cromática', continuidade: 'Continuidade / contraste' };
export type Move = { to: Chord; motion: Motion; why: string; nextCenter: Center; options: Move[]; resolvesTo?: Chord; relation?: Relation; commonNotes?: number[]; localTarget?: Chord };

export const QUALITIES: readonly Quality[] = ['7M', '', '6', '7M(9)', '6(9)', 'm7', 'm', 'm6', 'm7(9)', 'm(7M)', '7', '7(9)', '7(13)', '7(b9)', '7(#5)', '7sus4', 'm7(b5)', '°7', '°', '+', 'm7(11)', 'm7(9,11)', 'm6(9)', '7(#11)', '7(#9)', '7(b13)', '7(9,13)', '7(b9,b13)', '7M(#11)', '7sus4(9)'];

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Key names as Brazilian charts write them; the flat keys (Db, Gb, Ebm) make every chord in them come out with flats.
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

export const groupOf = (q: Quality): Group =>
  q === 'm7(b5)' ? 'hdim' : q === '°7' ? 'dim' : q === '°' ? 'dtri' : q === '+' ? 'aug' : q.includes('sus') ? 'sus' : q.startsWith('m') ? 'min' : q.startsWith('7') && !q.startsWith('7M') ? 'dom' : 'maj';
/** Tensions with altered notes: b9, #5, and the diminished seventh (a 7(b9) without its root). */
export const isAltered = (c: Chord): boolean => /b9|#9|#5|b13|#11/u.test(c.quality) || ['°', '°7', '+'].includes(c.quality);
const isDark = (q: Quality) => q === '7(b9)' || q === '7(#5)';

/** Identity of a star: root + function group. C#7 and Db7, G7 and G7(b9) are the same star. */
export const chordKey = (c: Chord): string => `${mod12(c.root)}:${groupOf(c.quality)}${c.bass === undefined ? '' : `/${mod12(c.bass)}`}`;

export const centerName = (center: Center): string => (center.minor ? MINOR_KEYS : MAJOR_KEYS)[mod12(center.root)]!;

export const chordName = (c: Chord, center: Center): string => `${spellPitch(mod12(c.root), c.flat ? true : centerName(center))}${c.quality}${c.bass === undefined ? '' : `/${spellPitch(mod12(c.bass), centerName(center))}`}`;

export const parseChord = (name: string): Chord | null => {
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/u.exec(name.trim());
  if (!m || !(QUALITIES as readonly string[]).includes(m[3]!)) return null;
  const root = mod12(NOTE_PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
  return { root, quality: m[3] as Quality, ...(m[2] === 'b' ? { flat: true } : {}), ...(m[4] ? { bass: mod12(NOTE_PC[m[4]]! + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0)) } : {}) };
};

/** The center a starting chord implies: a dominant points to its resolution, a iiø to its minor key. */
export const startCenter = (c: Chord): Center => {
  switch (groupOf(c.quality)) {
    case 'min':
      return { root: c.root, minor: true };
    case 'dom':
    case 'sus':
      return { root: mod12(c.root + 5), minor: false };
    case 'hdim':
      return { root: mod12(c.root + 10), minor: true };
    case 'dim':
    case 'dtri':
      return { root: mod12(c.root + 1), minor: false };
    default:
      return { root: c.root, minor: false };
  }
};

const degree = (root: number, center: Center) => mod12(root - center.root);

/** Rest, moving away or tension, for a chord in its center. */
export const levelOf = (c: Chord, center: Center): Level => {
  const d = degree(c.root, center);
  switch (groupOf(c.quality)) {
    case 'dom':
    case 'dim':
    case 'dtri':
      return 'tensao';
    case 'sus':
    case 'aug':
      return 'afastamento';
    case 'hdim':
      return !center.minor && d === 11 ? 'tensao' : 'afastamento';
    case 'maj':
      return (!center.minor && d === 5) || (center.minor && d === 8) ? 'afastamento' : 'repouso';
    case 'min':
      return (!center.minor && (d === 9 || d === 4)) || (center.minor && d === 0) ? 'repouso' : 'afastamento';
  }
};

/** Degrees (from the center) whose diatonic chord is minor: a plain dominant resolves to m7 there. */
const minorDegree = (pc: number, center: Center) => (center.minor ? [0, 5] : [2, 4, 9]).includes(degree(pc, center));

/** cur: current · res: where the current resolves · to: destination · target: a fourth above the destination · iiOf: the key the current is the ii of · toKey: the key the destination is the ii of. */
type Ctx = { cur: string; res: string; to: string; target: string; iiOf: string; toKey: string; center: string; next: string; root: string };
type Spelling = boolean | 'inherit';
type Rule = {
  at: number;
  quality: Quality;
  from?: 'r' | 'c';
  flat?: Spelling;
  /** The step is the dominant's own resolution (r+5): it may move the center. */
  resolution?: boolean;
  /** Keep the center even for a chord outside the key (borrowed, deceptive). */
  keep?: boolean;
  /** A half-diminished that works as a dominant substitute (counts as tension). */
  tension?: boolean;
  /** A substitute dominant: where it resolves (the current chord, the key it is the ii of, or the center tonic), not a fourth above. */
  resolvesTo?: 'cur' | 'iiOf' | 'home';
  /** Forces the motion (a dominant turning into its own minor only loses the tension: it relaxes, it does not resolve). */
  motion?: Motion;
  relation?: Relation;
  why: (n: Ctx) => string;
};

const S = (at: number, quality: Quality, why: Rule['why'], extra: Omit<Rule, 'at' | 'quality' | 'why'> = {}): Rule => ({ at, quality, why, ...extra });

/* ---------- The rules, by the level of the current chord (§9.2 of the spec) ---------- */

const REST_MAJOR: Rule[] = [
  S(7, '7', (n) => `${n.to} é o dominante: a tensão que pede ${n.cur} de volta.`),
  S(11, 'm7(b5)', (n) => `${n.to} tem o mesmo trítono do dominante: tensão com outra cor, resolve em ${n.cur}.`, { tension: true }),
  S(1, '7', (n) => `${n.to} é o substituto de trítono: mesma tensão do dominante, o baixo desce meio tom até ${n.cur}.`, { flat: true, resolvesTo: 'cur' }),
  S(9, '7', (n) => `${n.to} é o dominante de ${n.target}m: tensão de fora do tom que puxa para o ii.`),
  S(2, '7', (n) => `${n.to} é o V7 do V: o dominante do dominante, puxa para ${n.target}.`),
  S(4, '7', (n) => `${n.to} é o dominante de ${n.target}m: tensão que puxa para o relativo menor.`),
  S(10, '7', (n) => `${n.to} vem do tom menor (bVII7): o dominante "pela porta dos fundos", resolve em ${n.cur} com cor de gospel.`, { flat: true, resolvesTo: 'cur' }),
  S(0, '7', (n) => `${n.to}: ${n.cur} passa a usar sétima menor e vira tensão que pede ${n.target}.`),
  S(1, '°7', (n) => `${n.to} é diminuto de passagem: tensão que sobe meio tom até o ii.`),
  S(2, 'm7', (n) => `${n.to} é o ii: afasta do repouso e prepara a tensão.`),
  S(5, '7M', (n) => `${n.to} é o IV: afastamento com cor de subdominante.`),
  S(9, 'm7', (n) => `${n.to} é o relativo menor: mesmo repouso, cor mais escura.`),
  S(4, 'm7', (n) => `${n.to} mantém notas de ${n.cur}; compare a continuidade sem confundir notas comuns com função idêntica.`),
  S(5, 'm6', (n) => `${n.to} vem do tom menor: o subdominante menor, aquele som de "amém".`, { flat: true, keep: true }),
  S(8, '7M', (n) => `${n.to} vem do tom menor (bVI): uma cor épica que volta bem para ${n.cur}.`, { flat: true, keep: true }),
];

/** A major chord at the IV of its center (F7M in C). */
const AWAY_MAJOR: Rule[] = [
  S(7, '7', (n) => `${n.to} é o dominante do centro ${n.center}: da subdominante para a tensão.`, { from: 'c' }),
  S(11, 'm7(b5)', (n) => `${n.to} tem o trítono do dominante de ${n.center}: tensão com outra cor.`, { from: 'c', tension: true }),
  S(1, '7', (n) => `${n.to} é o substituto de trítono do dominante de ${n.center}.`, { from: 'c', flat: true, resolvesTo: 'home' }),
  S(1, '°7', (n) => `${n.to} é diminuto de passagem: sobe meio tom rumo ao V.`),
  S(0, '7', (n) => `${n.to}: passa a usar sétima menor e vira tensão que pede ${n.target}.`),
  S(0, '7M', (n) => `${n.to}: cadência plagal, o IV volta ao repouso (o "amém").`, { from: 'c' }),
  S(0, 'm6', (n) => `${n.to}: o subdominante fica menor, cor de "amém" antes de voltar.`, { flat: true, keep: true }),
  S(2, 'm7', (n) => `${n.to} é o ii: outro acorde de afastamento, prepara a tensão.`, { from: 'c' }),
];

/** Any minor chord (ii, iii, vi…): it can act as the ii of a ii–V, or stay relaxed. */
const MINOR: Rule[] = [
  S(5, '7', (n) => `${n.cur} funciona como ii: com ${n.to} forma o ii–V que leva a ${n.iiOf}.`),
  S(9, 'm7(b5)', (n) => `${n.to} tem o trítono do V de ${n.iiOf}: tensão com outra cor.`, { tension: true }),
  S(11, '7', (n) => `${n.to} é o substituto de trítono do V de ${n.iiOf}: o baixo desce em semitons.`, { flat: true, resolvesTo: 'iiOf' }),
  S(7, '7', (n) => `${n.to} é o dominante de ${n.cur}: tensão que volta para ele.`),
  S(5, 'm7', (n) => `${n.to} é o ii de ${n.toKey}: a cadeia de ii andando pelo ciclo de quartas.`),
  S(3, '7M', (n) => `${n.to} é o relativo maior de ${n.cur}: a mesma região, com cor clara.`, { keep: true }),
];

/** The minor subdominant (iv, or any m6 in a major center) goes home by the plagal cadence. */
const PLAGAL_MINOR: Rule[] = [S(0, '7M', (n) => `${n.to}: cadência plagal menor (iv → I), o "amém" que volta para casa.`, { from: 'c' })];

/** The stable chords of a major center, to relax between them (C7M ↔ Am7 ↔ Em7 ↔ F7M ↔ Dm7). */
const DIATONIC_REST: Rule[] = [
  S(7, '7', (n) => `${n.to} é o dominante do centro ${n.center}: do repouso direto para a tensão.`, { from: 'c' }),
  S(0, '7M', (n) => `${n.to} é a tônica do centro ${n.center}: a volta para casa.`, { from: 'c' }),
  S(9, 'm7', (n) => `${n.to} é o relativo menor: continua no repouso.`, { from: 'c' }),
  S(4, 'm7', (n) => `${n.to} é o iii: pode prolongar a região de tônica, conforme a melodia.`, { from: 'c' }),
  S(5, '7M', (n) => `${n.to} é o IV: afastamento suave, sem tensão.`, { from: 'c' }),
  S(2, 'm7', (n) => `${n.to} é o ii: afasta e prepara a tensão.`, { from: 'c' }),
];

/** The tonic of a minor center (Am7 in A minor). */
const MINOR_TONIC: Rule[] = [
  S(7, '7(b9)', (n) => `${n.to} é o V7 da menor harmônica: a tensão que pede ${n.cur}.`),
  S(1, '7', (n) => `${n.to} é o substituto de trítono do V: o baixo desce meio tom até ${n.cur}.`, { flat: true, resolvesTo: 'cur' }),
  S(10, '7', (n) => `${n.to} é o VII7: tensão que leva ao relativo maior.`),
  S(5, '7', (n) => `${n.cur} também funciona como ii: com ${n.to} forma o ii–V que leva a ${n.iiOf}.`),
  S(2, 'm7(b5)', (n) => `${n.to} é o iiø do tom menor: afasta e prepara o V.`),
  S(5, 'm7', (n) => `${n.to} é o iv: o subdominante do tom menor.`),
  S(8, '7M', (n) => `${n.to} é o VI: afastamento com cor maior dentro do tom menor.`, { keep: true }),
  S(3, '7M', (n) => `${n.to} é o relativo maior: as mesmas notas, com cor clara.`, { keep: true }),
];

/** A half-diminished that prepares (iiø of a minor key). */
const AWAY_HDIM: Rule[] = [
  S(5, '7(b9)', (n) => `${n.cur} é o iiø e ${n.to} o V: o ii–V do tom menor.`),
  S(11, '7', (n) => `${n.to} é o substituto de trítono do V: mesmo trítono, outro baixo.`, { flat: true, resolvesTo: 'home' }),
  S(3, 'm6', (n) => `${n.to} tem as mesmas notas de ${n.cur}: só muda o baixo, continua relaxado.`),
  S(8, '7', (n) => `${n.cur} é ${n.to}(9) sem a fundamental: vira essa tensão, que pede ${n.target}.`),
  S(6, '7M', (n) => `${n.to} divide notas com ${n.cur}: relaxa sem passar pela tensão.`, { keep: true }),
];

/**
 * Dominants may resolve locally, continue, or exchange their tritone for another bass.
 * A substitute retains the destination of the relationship that introduced it.
 */
const dominantRules = (current: Chord, center: Center, target?: Chord): Rule[] => {
  const q = current.quality;
  const tAt = target ? mod12(target.root - current.root) : 5;
  const resolveTo = (quality: Quality) =>
    S(tAt, quality, (n) => `${n.cur} chega a ${n.to}: resolução local possível, sem confirmar por si só uma modulação.${n.next}`, { flat: target?.flat ? true : 'inherit', resolution: true });
  // A substitute resolves where it was aimed; otherwise dark colors (b9, #5) ask for the minor first, clear ones (9, 13)
  // for the major, and a plain 7 for what its center expects first and the other mode next (E7 in C: Am7, then A7M,
  // which closes the cadence in a new key).
  const expected: Quality = minorDegree(current.root + 5, center) ? 'm7' : '7M';
  const resolutions = target
    ? [resolveTo(target.quality)]
    : isDark(q)
      ? [resolveTo('m7'), resolveTo('7M')]
      : [resolveTo(expected), resolveTo(expected === 'm7' ? '7M' : 'm7')];
  const mainMinor = groupOf(resolutions[0]!.quality) === 'min';
  // Deceptive cadences: the relative minor and the iii only make sense when the expected resolution is major; bVI always.
  const deceptive = [
    ...(mainMinor
      ? []
      : [
          S(tAt + 9, 'm7', (n) => `${n.to}: possibilidade de cadência de engano, em vez de ${n.res} chega ao relativo menor.`, { flat: 'inherit', keep: true, motion: 'resolve', relation: 'resolucao' }),
          S(tAt + 4, 'm7', (n) => `${n.to}: continuidade no iii, sem confirmar a chegada em ${n.res}.`, { flat: 'inherit', keep: true, relation: 'notas-comuns' }),
        ]),
    S(tAt + 8, '7M', (n) => `${n.to}: possibilidade de chegada de engano no bVI, no lugar de ${n.res}.`, { flat: true, keep: true, motion: 'resolve', relation: 'resolucao' }),
  ];
  return [
    ...resolutions,
    ...deceptive,
    S(6, '7', (n) => `${n.to} compartilha o trítono de ${n.cur}: substituição que mantém a tensão e o destino local.`, { flat: true, relation: 'substituicao', motion: 'tensiona' }),
    S(5, '7', (n) => `${n.to}: ${n.cur} passa a tensão adiante pelo ciclo de quartas, um dominante puxando outro.`, { flat: 'inherit' }),
    S(11, '7', (n) => `${n.to}: aproximação cromática, a tensão desce meio tom para outro dominante.`, { flat: 'inherit' }),
    S(1, '7', (n) => `${n.to}: aproximação cromática, a tensão sobe meio tom para outro dominante.`, { flat: true }),
    // G7 → Gm7: the tritone goes away and the chord becomes the ii of a new ii–V (Gm7 → C7 → F).
    S(0, 'm7', (n) => `${n.to}: ${n.cur} vira menor na mesma nota, perde o trítono e passa a ser o ii de um novo ii–V, que leva a ${n.iiOf}.`, { motion: 'relaxa' }),
  ];
};

/** A half-diminished as the dominant substitute (Bm7(b5) in C). */
const TENSION_HDIM: Rule[] = [
  S(1, '7M', (n) => `${n.cur} tem o trítono do dominante de ${n.to}: resolve subindo meio tom.`, { resolution: true }),
  S(10, 'm7', (n) => `${n.to}: engano, a tensão relaxa no relativo menor.`, { keep: true }),
  S(5, '7(b9)', (n) => `${n.cur} vira o iiø de um ii–V menor: ${n.to} continua a tensão.`),
];

const DIMINISHED: Rule[] = [
  S(1, 'm7', (n) => `${n.cur} sobe meio tom e chega a ${n.to}: diminuto de passagem.`, { resolution: true }),
  S(1, '7M', (n) => `${n.cur} sobe meio tom e chega a ${n.to}.`, { resolution: true }),
  ...[8, 11, 2, 5].map((at) => S(at, '7(b9)', (n) => `${n.cur} é ${n.to} sem a fundamental: vira esse dominante e continua a tensão.`, { flat: at === 2 })),
];

/** Changes of one triad tone; functional meaning is deliberately not inferred from similarity. */
const COMMON_TRIADS: Rule[] = [
  S(0, 'm', n => `${n.cur} → ${n.to}: na tríade, a terça desce um semitom; extensões podem ser retiradas.`, { relation: 'transformacao' }),
  S(0, '+', n => `${n.cur} → ${n.to}: na tríade, a quinta sobe um semitom; extensões podem ser retiradas.`, { relation: 'transformacao' }),
  S(8, '', n => `${n.to}: explore as notas comuns com ${n.cur} e o contraste harmônico.`, { flat: true, keep: true, relation: 'notas-comuns' }),
];
const AUGMENTED: Rule[] = [
  ...[0, 4, 8].flatMap(at => [
    S(at, '', n => `${n.cur} → ${n.to}: uma nota desce um semitom e duas permanecem.`, { relation: 'transformacao', keep: true }),
    S(at + 1, 'm', n => `${n.cur} → ${n.to}: uma nota sobe um semitom e duas permanecem.`, { relation: 'transformacao', keep: true }),
  ]),
];
const SUSPENDED: Rule[] = [
  S(0, '7', n => `${n.cur} → ${n.to}: a quarta desce para a terça maior, formando o trítono do dominante.`, { relation: 'transformacao', motion: 'tensiona' }),
  S(5, '7M', n => `${n.cur} → ${n.to}: chegada com suspensão; o acorde de origem não possui a terça do dominante.`, { resolution: true }),
  S(5, 'm7', n => `${n.cur} → ${n.to}: possível chegada menor; confira a condução da quarta suspensa.`, { resolution: true }),
];
const MINOR_TRANSFORMATIONS: Rule[] = [
  S(0, '', n => `${n.cur} → ${n.to}: na tríade, a terça sobe um semitom; extensões podem ser retiradas.`, { relation: 'transformacao' }),
  S(0, '°', n => `${n.cur} → ${n.to}: na tríade, a quinta desce um semitom; extensões podem ser retiradas.`, { relation: 'transformacao' }),
  S(11, '+', n => `${n.cur} → ${n.to}: a fundamental da tríade desce um semitom até uma tríade aumentada.`, { relation: 'transformacao' }),
];

/** A plain major triad: no seventh, no fixed intention (G can be I, the IV of D or a soft V of C). */
const TRIAD: Rule[] = [
  S(0, '7', (n) => `${n.to}: a tríade passa a usar sétima menor e vira tensão que pede ${n.target}.`),
  S(7, '7', (n) => `${n.to} é o dominante de ${n.cur}: tensão que pede a volta.`),
  S(7, '7M', (n) => `${n.to}: ${n.cur} funciona como IV de ${n.root}, cadência plagal.${n.next}`),
  S(5, '', (n) => `${n.to}: ${n.cur} funciona como V sem sétima, uma resolução suave sem tensão.`),
  S(2, 'm7', (n) => `${n.to} é o ii: afasta e prepara a tensão.`),
  S(9, 'm7', (n) => `${n.to} é o relativo menor: continua no repouso.`),
  S(4, 'm7', (n) => `${n.to} divide notas com ${n.cur}: continua relaxado.`),
];

const rulesFor = (current: Chord, center: Center, target?: Chord): Rule[] => {
  const level = levelOf(current, center);
  switch (groupOf(current.quality)) {
    case 'sus':
      return target ? [SUSPENDED[0]!, S(mod12(target.root - current.root), target.quality, n => `${n.cur} chega a ${n.to} mantendo o destino exploratório escolhido; não há terça maior no acorde suspenso.`, { resolution: true })] : SUSPENDED;
    case 'aug':
      return AUGMENTED;
    case 'dom':
      return dominantRules(current, center, target);
    case 'dim':
    case 'dtri':
      return current.quality === '°' ? [
        S(0, '°7', n => `${n.to}: acrescenta sétima diminuta à tríade; a simetria pertence à tétrade.`, { relation: 'transformacao' }),
        ...DIMINISHED.slice(0, 2),
      ] : [...DIMINISHED, ...[3, 6, 9].map(at => S(at, '°7', n => `${n.to} mantém as mesmas classes de altura de ${n.cur}; reinterpretação enarmônica, não modulação automática.`, { relation: 'substituicao', motion: 'tensiona' }))];
    case 'hdim':
      return level === 'tensao' ? TENSION_HDIM : AWAY_HDIM;
    case 'min':
      if (center.minor && degree(current.root, center) === 0) return [...MINOR_TONIC, ...MINOR_TRANSFORMATIONS];
      if (!center.minor && degree(current.root, center) === 5) return [...PLAGAL_MINOR, ...MINOR, ...MINOR_TRANSFORMATIONS];
      return [...(level === 'repouso' && !center.minor ? [...MINOR, ...DIATONIC_REST] : MINOR),
        ...MINOR_TRANSFORMATIONS,
      ];
    case 'maj':
      if (current.quality === '') return [...TRIAD, ...COMMON_TRIADS];
      return level === 'afastamento' ? [...AWAY_MAJOR, ...COMMON_TRIADS.slice(0, 2)] : [...REST_MAJOR.slice(0, 9), ...COMMON_TRIADS.slice(0, 2), ...REST_MAJOR.slice(9)];
  }
};

/* ---------- Building moves ---------- */

const MIN_ORBIT = 6;
const MAX_ORBIT = 16;
const isTension = (c: Chord, rule?: Rule) => ['dom', 'dim', 'dtri'].includes(groupOf(c.quality)) || (groupOf(c.quality) === 'hdim' && !!rule?.tension);

const motionOf = (_fromLevel: Level, to: Chord, rule?: Rule): Motion =>
  rule?.motion ?? (rule?.resolution ? 'resolve' : isTension(to, rule) ? 'tensiona' : 'relaxa');

/** Keep the reference center; adopting another center is an explicit exploration choice. */
const centerAfter = (_to: Chord, center: Center, _rule: { resolution?: boolean; keep?: boolean }): Center => center;

const BALLOON: Record<Group, Quality[]> = {
  maj: ['', '7M', '6', '7M(9)', '6(9)', '7M(#11)', '7', '7(9)', '7(13)', '+'],
  dom: ['7', '7(9)', '7(13)', '7(9,13)', '7(b9)', '7(#9)', '7(#5)', '7(#11)', '7(b13)', '7(b9,b13)', '7sus4', '7sus4(9)', '', '7M', '6'],
  min: ['m', 'm7', 'm7(9)', 'm7(11)', 'm7(9,11)', 'm6', 'm6(9)', 'm(7M)'],
  hdim: ['m7(b5)'],
  dim: ['°7'],
  dtri: ['°', '°7', 'm7(b5)'],
  aug: ['+'],
  sus: ['7sus4', '7sus4(9)', '7'],
};

/** Names of the degrees of a key, to tell where a new center sits in the old one. */
const MAJOR_DEGREES: Record<number, string> = { 2: 'ii', 4: 'iii', 5: 'IV', 7: 'V', 9: 'vi' };
const MINOR_DEGREES: Record<number, string> = { 3: 'III', 5: 'iv', 7: 'V', 8: 'VI', 10: 'VII' };

const sameCenter = (a: Center, b: Center) => a.root === b.root && a.minor === b.minor;

/** Pitch sets are measured, never inferred from a family label or a hard-coded count. */
export const commonTones = (from: Chord, to: Chord, center: Center): number[] => {
  const a = chordNotes(chordName(from, center)) ?? [];
  const b = new Set(chordNotes(chordName(to, center)) ?? []);
  return a.filter(pc => b.has(pc));
};
const relationFor = (from: Chord, to: Chord, rule: Rule, common: number[], center: Center): Relation => {
  if (rule.relation) return rule.relation;
  if (rule.resolution) return 'resolucao';
  if (rule.resolvesTo) return 'substituicao';
  if (from.root === to.root) return 'transformacao';
  if ((groupOf(from.quality) === 'min' || groupOf(from.quality) === 'hdim') && groupOf(to.quality) === 'dom' && mod12(to.root - from.root) === 5) return 'preparacao';
  if (rule.keep && !center.minor && ((groupOf(to.quality) === 'maj' && [3, 8, 10].includes(degree(to.root, center))) || (groupOf(to.quality) === 'min' && degree(to.root, center) === 5))) return 'emprestimo';
  if (common.length >= 2) return 'notas-comuns';
  return 'continuidade';
};
const measuredNotes = (from: Chord, to: Chord, center: Center): string => {
  const common = commonTones(from, to, center);
  return common.length ? ` Notas comuns (${common.length}): ${common.map(pc => spellPitch(pc, centerName(center))).join(', ')}.` : ' Sem notas comuns: explore a condução das vozes e o contraste.';
};
const hint = (to: Chord, _motion: Motion, name: string, res: string, _nextCenter: Center, _center: Center): string => {
  const formula = CHORD_TYPES.find(type => type.suffix === to.quality);
  const destination = ['dom', 'sus'].includes(groupOf(to.quality)) ? ` Destino local sugerido: ${res}; a extensão não determina sozinha o modo da chegada.` : '';
  return `${name}: ${formula?.about ?? 'Compare as notas e a disposição das vozes.'}${destination}`;
};

/** The next steps from `current` in `center`. `resolvesTo` is where a substitute dominant was aimed (see Move.resolvesTo). */
export const neighbors = (current: Chord, center: Center, resolvesTo?: Chord): Move[] => {
  const level = levelOf(current, center);
  const moves: Move[] = [];
  const seen = new Set([chordKey(current)]);
  const cur = chordName(current, center);
  const res = resolvesTo ? chordName(resolvesTo, center) : chordName({ root: mod12(current.root + 5), quality: '', ...(current.flat ? { flat: true } : {}) }, center);

  const build = (rule: Rule) => {
    const root = mod12((rule.from === 'c' ? center.root : current.root) + rule.at);
    const flat = rule.flat === 'inherit' ? !!current.flat : !!rule.flat;
    const to: Chord = { root, quality: rule.quality, ...(flat ? { flat: true } : {}) };
    if (seen.has(chordKey(to)) || moves.length >= MAX_ORBIT) return;
    seen.add(chordKey(to));
    const motion = motionOf(level, to, rule);
    const nextCenter = centerAfter(to, center, rule);
    const name = chordName(to, nextCenter);
    // When the new center is a degree of the old one, say so: "o centro tonal passa a ser Dm (o ii de C)".
    const degreeName = (center.minor ? MINOR_DEGREES : MAJOR_DEGREES)[degree(root, center)];
    const next = sameCenter(nextCenter, center)
      ? ''
      : ` O centro tonal passa a ser ${chordName({ root, quality: nextCenter.minor ? 'm' : '', ...(flat ? { flat: true } : {}) }, nextCenter)}${degreeName ? ` (o ${degreeName} de ${centerName(center)})` : ''}.`;
    const ctx: Ctx = {
      cur,
      res,
      to: name,
      next,
      target: chordName({ root: mod12(root + 5), quality: '', ...(flat ? { flat: true } : {}) }, nextCenter),
      iiOf: chordName({ root: mod12(current.root + 10), quality: '' }, center),
      toKey: chordName({ root: mod12(root + 10), quality: '' }, nextCenter),
      center: centerName(center),
      root: chordName({ root, quality: '' }, nextCenter),
    };
    // Where a substitute dominant is aimed: the current chord, the key it is the ii of, or the center tonic.
    const aim: Chord | undefined =
      rule.relation === 'substituicao' && groupOf(to.quality) === 'dom'
        ? resolvesTo ?? { root: mod12(current.root + 5), quality: minorDegree(current.root + 5, center) ? 'm7' : '7M' }
        :
      rule.resolvesTo === 'cur'
        ? { root: current.root, quality: current.quality, ...(current.flat ? { flat: true } : {}) }
        : rule.resolvesTo === 'iiOf'
          ? { root: mod12(current.root + 10), quality: '7M' }
          : rule.resolvesTo === 'home'
            ? { root: center.root, quality: center.minor ? 'm7' : '7M' }
            : undefined;
    const localTarget: Chord | undefined = rule.resolution ? to : aim ?? (groupOf(to.quality) === 'dom' || groupOf(to.quality) === 'sus' ? { root: mod12(to.root + 5), quality: minorDegree(to.root + 5, center) ? 'm7' : '7M' } : undefined);
    const common = commonTones(current, to, center);
    const why = rule.why(ctx) + measuredNotes(current, to, center);
    const move: Move = { to, motion, why, nextCenter, relation: relationFor(current, to, rule, common, center), commonNotes: common, localTarget, options: [], ...(aim ? { resolvesTo: aim } : {}) };
    // The balloon: the other types of this root, each with its own motion, center and hint.
    // A tension that only passes the tension on (G7 → F#7) offers only other dominant colors: a stable type there would not be a resolution.
    const onlyTension = level === 'tensao' && motion === 'tensiona';
    const others = BALLOON[groupOf(rule.quality)]
      .filter((q) => q !== rule.quality && (!onlyTension || ['dom', 'sus'].includes(groupOf(q))))
      .map((q): Move => {
        const alt: Chord = { root, quality: q, ...(flat ? { flat: true } : {}) };
        const altMotion = motionOf(level, alt);
        const altCenter = centerAfter(alt, center, { resolution: rule.resolution && groupOf(q) !== 'dom', keep: rule.keep });
        const altName = chordName(alt, altCenter);
        const carriesAim = aim && ['dom', 'sus'].includes(groupOf(q));
        const altTarget = carriesAim ? aim : ['dom', 'sus'].includes(groupOf(q)) ? { root: mod12(root + 5), quality: minorDegree(root + 5, center) ? 'm7' as const : '7M' as const } : undefined;
        const common = commonTones(current, alt, center);
        const sameFamily = groupOf(q) === groupOf(to.quality);
        const alternativeRule = { ...rule, resolution: false, relation: undefined, resolvesTo: undefined, tension: false };
        return { to: alt, motion: sameFamily ? motion : altMotion, why: hint(alt, altMotion, altName, altTarget ? chordName(altTarget, center) : ctx.target, altCenter, center) + measuredNotes(current, alt, center), relation: sameFamily ? move.relation : relationFor(current, alt, alternativeRule, common, center), commonNotes: common, localTarget: rule.resolution && sameFamily ? alt : altTarget, nextCenter: altCenter, options: [], ...(carriesAim ? { resolvesTo: aim } : {}) };
      });
    move.options = [{ ...move, options: [] }, ...others];
    moves.push(move);
  };

  for (const rule of rulesFor(current, center, resolvesTo)) build(rule);
  // Stable chords with few paths still get the center's essentials (home, its V7, its ii).
  if (level !== 'tensao' && moves.length < MIN_ORBIT) {
    for (const rule of [
      S(0, center.minor ? 'm7' : '7M', (n) => `${n.to} é a tônica do centro ${n.center}: a volta para casa.`, { from: 'c' }),
      S(7, '7', (n) => `${n.to} é o dominante do centro ${n.center}: a tensão que pede a volta.`, { from: 'c' }),
      S(2, center.minor ? 'm7(b5)' : 'm7', (n) => `${n.to} é o ii do centro ${n.center}: prepara a tensão.`, { from: 'c' }),
    ])
      build(rule);
  }
  const order: Record<Motion, number> = { resolve: 0, tensiona: 1, relaxa: 2 };
  return moves
    .map((m, i) => ({ m, i }))
    .sort((a, b) => order[a.m.motion] - order[b.m.motion] || a.i - b.i)
    .map(({ m }) => m);
};
