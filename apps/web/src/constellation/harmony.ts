import { spellPitch } from '../lib/transpose.ts';

/**
 * The harmony engine of the Constelação de acordes. Harmony moves by tension and resolution: every chord,
 * in its center, is at rest (repouso), moving away (afastamento) or in tension (tensão), and every next
 * step either relaxes, adds tension or resolves it. Substitutes (same tritone) show up where the tension is
 * approached, never after it; a dominant only resolves, cheats (deceptive) or hands its tension on (cycle
 * of fourths, chromatic approach). The type the student picks (G, G7, G7(b9)…) is a choice of intention.
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
  | '°7';
/** `root` is a pitch class (0 = C). `flat` forces a flat spelling (tritone subs, borrowed chords). */
export type Chord = { root: number; quality: Quality; flat?: boolean };
export type Center = { root: number; minor: boolean };
export type Group = 'maj' | 'min' | 'dom' | 'hdim' | 'dim';
export type Level = 'repouso' | 'afastamento' | 'tensao';
export type Motion = 'relaxa' | 'tensiona' | 'resolve';
/** A step: where to, the motion, why it works, the center after it, and the other types of that root (the balloon). */
export type Move = { to: Chord; motion: Motion; why: string; nextCenter: Center; options: Move[]; resolvesTo?: Chord };

export const QUALITIES: readonly Quality[] = ['7M', '', '6', '7M(9)', '6(9)', 'm7', 'm', 'm6', 'm7(9)', 'm(7M)', '7', '7(9)', '7(13)', '7(b9)', '7(#5)', '7sus4', 'm7(b5)', '°7'];

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Key names as Brazilian charts write them; the flat keys (Db, Gb, Ebm) make every chord in them come out with flats.
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

export const groupOf = (q: Quality): Group =>
  q === 'm7(b5)' ? 'hdim' : q === '°7' ? 'dim' : q.startsWith('m') ? 'min' : q.startsWith('7') && !q.startsWith('7M') ? 'dom' : 'maj';
/** Tensions with altered notes: b9, #5, and the diminished seventh (a 7(b9) without its root). */
export const isAltered = (c: Chord): boolean => c.quality === '7(b9)' || c.quality === '7(#5)' || c.quality === '°7';
const isDark = (q: Quality) => q === '7(b9)' || q === '7(#5)';
const isClear = (q: Quality) => q === '7(9)' || q === '7(13)';

/** Identity of a star: root + function group. C#7 and Db7, G7 and G7(b9) are the same star. */
export const chordKey = (c: Chord): string => `${mod12(c.root)}:${groupOf(c.quality)}`;

export const centerName = (center: Center): string => (center.minor ? MINOR_KEYS : MAJOR_KEYS)[mod12(center.root)]!;

export const chordName = (c: Chord, center: Center): string => `${spellPitch(mod12(c.root), c.flat ? true : centerName(center))}${c.quality}`;

export const parseChord = (name: string): Chord | null => {
  const m = /^([A-G])([#b]?)(.*)$/u.exec(name.trim());
  if (!m || !(QUALITIES as readonly string[]).includes(m[3]!)) return null;
  const root = mod12(NOTE_PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
  return { root, quality: m[3] as Quality, ...(m[2] === 'b' ? { flat: true } : {}) };
};

/** The center a starting chord implies: a dominant points to its resolution, a iiø to its minor key. */
export const startCenter = (c: Chord): Center => {
  switch (groupOf(c.quality)) {
    case 'min':
      return { root: c.root, minor: true };
    case 'dom':
      return { root: mod12(c.root + 5), minor: false };
    case 'hdim':
      return { root: mod12(c.root + 10), minor: true };
    case 'dim':
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
      return 'tensao';
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
  S(0, '7', (n) => `${n.to}: ${n.cur} ganha sétima menor e vira tensão que pede ${n.target}.`),
  S(1, '°7', (n) => `${n.to} é diminuto de passagem: tensão que sobe meio tom até o ii.`),
  S(2, 'm7', (n) => `${n.to} é o ii: afasta do repouso e prepara a tensão.`),
  S(5, '7M', (n) => `${n.to} é o IV: afastamento com cor de subdominante.`),
  S(9, 'm7', (n) => `${n.to} é o relativo menor: mesmo repouso, cor mais escura.`),
  S(4, 'm7', (n) => `${n.to} divide três notas com ${n.cur}: continua relaxado, quase a mesma função.`),
  S(5, 'm6', (n) => `${n.to} vem do tom menor: o subdominante menor, aquele som de "amém".`, { flat: true, keep: true }),
  S(8, '7M', (n) => `${n.to} vem do tom menor (bVI): uma cor épica que volta bem para ${n.cur}.`, { flat: true, keep: true }),
];

/** A major chord at the IV of its center (F7M in C). */
const AWAY_MAJOR: Rule[] = [
  S(7, '7', (n) => `${n.to} é o dominante do centro ${n.center}: da subdominante para a tensão.`, { from: 'c' }),
  S(11, 'm7(b5)', (n) => `${n.to} tem o trítono do dominante de ${n.center}: tensão com outra cor.`, { from: 'c', tension: true }),
  S(1, '7', (n) => `${n.to} é o substituto de trítono do dominante de ${n.center}.`, { from: 'c', flat: true, resolvesTo: 'home' }),
  S(1, '°7', (n) => `${n.to} é diminuto de passagem: sobe meio tom rumo ao V.`),
  S(0, '7', (n) => `${n.to}: ganha sétima menor e vira tensão que pede ${n.target}.`),
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
  S(4, 'm7', (n) => `${n.to} é o iii: outro relativo, continua relaxado.`, { from: 'c' }),
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

/** The dominants: resolve, cheat, or hand the tension on. Never their own substitutes. */
/**
 * The dominants: resolve, cheat, or hand the tension on. Never their own substitutes. A substitute (Db7
 * reached as the subV of C, Bb7 as the backdoor of C) resolves where it was meant to: `target`.
 */
const dominantRules = (current: Chord, center: Center, target?: Chord): Rule[] => {
  const q = current.quality;
  const tAt = target ? mod12(target.root - current.root) : 5;
  const resolveTo = (quality: Quality) =>
    S(tAt, quality, (n) => `${n.cur} resolve em ${n.to}: a tensão do trítono se desfaz.${n.next}`, { flat: target?.flat ? true : 'inherit', resolution: true });
  // A substitute resolves where it was aimed; otherwise dark colors (b9, #5) ask for the minor first, clear ones (9, 13)
  // for the major, and a plain 7 for what its center expects first and the other mode next (E7 in C: Am7, then A7M,
  // which closes the cadence in a new key).
  const expected: Quality = minorDegree(current.root + 5, center) ? 'm7' : '7M';
  const resolutions = target
    ? [resolveTo(target.quality)]
    : isDark(q)
      ? [resolveTo('m7'), resolveTo('7M')]
      : isClear(q)
        ? [resolveTo('7M')]
        : [resolveTo(expected), resolveTo(expected === 'm7' ? '7M' : 'm7')];
  const mainMinor = groupOf(resolutions[0]!.quality) === 'min';
  // Deceptive cadences: the relative minor and the iii only make sense when the expected resolution is major; bVI always.
  const deceptive = [
    ...(mainMinor
      ? []
      : [
          S(tAt + 9, 'm7', (n) => `${n.to}: cadência de engano, em vez de ${n.res} vai para o relativo menor.`, { flat: 'inherit', keep: true }),
          S(tAt + 4, 'm7', (n) => `${n.to}: engano no iii, repousa sem chegar em ${n.res}.`, { flat: 'inherit', keep: true }),
        ]),
    S(tAt + 8, '7M', (n) => `${n.to}: engano no bVI, uma resolução de surpresa no lugar de ${n.res}.`, { flat: true, keep: true }),
  ];
  return [
    ...resolutions,
    ...deceptive,
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
  S(1, 'm7', (n) => `${n.cur} sobe meio tom e resolve em ${n.to}: diminuto de passagem.`),
  S(1, '7M', (n) => `${n.cur} sobe meio tom e resolve em ${n.to}.`),
  ...[8, 11, 2, 5].map((at) => S(at, '7(b9)', (n) => `${n.cur} é ${n.to} sem a fundamental: vira esse dominante e continua a tensão.`, { flat: at === 2 })),
];

/** A plain major triad: no seventh, no fixed intention (G can be I, the IV of D or a soft V of C). */
const TRIAD: Rule[] = [
  S(0, '7', (n) => `${n.to}: a tríade ganha sétima menor e vira tensão que pede ${n.target}.`),
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
    case 'dom':
      return dominantRules(current, center, target);
    case 'dim':
      return DIMINISHED;
    case 'hdim':
      return level === 'tensao' ? TENSION_HDIM : AWAY_HDIM;
    case 'min':
      if (center.minor && degree(current.root, center) === 0) return MINOR_TONIC;
      if (!center.minor && (degree(current.root, center) === 5 || current.quality === 'm6')) return [...PLAGAL_MINOR, ...MINOR];
      return level === 'repouso' && !center.minor ? [...MINOR, ...DIATONIC_REST] : MINOR;
    case 'maj':
      if (current.quality === '') return TRIAD;
      return level === 'afastamento' ? AWAY_MAJOR : REST_MAJOR;
  }
};

/* ---------- Building moves ---------- */

const MIN_ORBIT = 6;
const MAX_ORBIT = 16;
const isTension = (c: Chord, rule?: Rule) => ['dom', 'dim'].includes(groupOf(c.quality)) || (groupOf(c.quality) === 'hdim' && !!rule?.tension);

const motionOf = (fromLevel: Level, to: Chord, rule?: Rule): Motion =>
  rule?.motion ?? (isTension(to, rule) ? 'tensiona' : fromLevel === 'tensao' ? 'resolve' : 'relaxa');

/** The center after a step: resolutions and 7M chords outside the key move it; borrowed and deceptive chords keep it. */
const centerAfter = (to: Chord, center: Center, rule: { resolution?: boolean; keep?: boolean }): Center => {
  const g = groupOf(to.quality);
  const d = degree(to.root, center);
  if (rule.keep) return center;
  if (rule.resolution) {
    // A minor chord that is a degree of the key resolves locally (A7 → Dm7 stays in C); elsewhere it becomes the center.
    // Every resolution moves the center to the chord it lands on (A7 → Dm7: the center becomes Dm).
    if (g === 'min') return d === 0 && center.minor ? center : { root: mod12(to.root), minor: true };
    if (g === 'maj') return d === 0 && !center.minor ? center : { root: mod12(to.root), minor: false };
    return center;
  }
  if (g === 'maj') {
    const homeDegrees = to.quality === '' || to.quality === '6' ? (center.minor ? [3, 8, 10] : [0, 5, 7]) : center.minor ? [3, 8] : [0, 5];
    if (!homeDegrees.includes(d)) return { root: mod12(to.root), minor: false };
  }
  return center;
};

const BALLOON: Record<Group, Quality[]> = {
  maj: ['', '7M', '6', '7', '7(9)', '7(13)', '7(b9)', '7(#5)', '7sus4'],
  dom: ['', '7M', '7', '7(9)', '7(13)', '7(b9)', '7(#5)', '7sus4'],
  min: ['m7', 'm7(9)', 'm6', 'm', '7'],
  hdim: ['m7(b5)'],
  dim: ['°7'],
};

/** Names of the degrees of a key, to tell where a new center sits in the old one. */
const MAJOR_DEGREES: Record<number, string> = { 2: 'ii', 4: 'iii', 5: 'IV', 7: 'V', 9: 'vi' };
const MINOR_DEGREES: Record<number, string> = { 3: 'III', 5: 'iv', 7: 'V', 8: 'VI', 10: 'VII' };

const sameCenter = (a: Center, b: Center) => a.root === b.root && a.minor === b.minor;

/** One line on what a type does here, for the balloon. */
const hint = (to: Chord, motion: Motion, name: string, res: string, nextCenter: Center, center: Center): string => {
  const moved = sameCenter(nextCenter, center) ? '' : ` O centro tonal passa a ser ${centerName(nextCenter)}.`;
  switch (to.quality) {
    case '':
      return `${name}: sem sétima, soa suave e não pede nada.${moved}`;
    case '7M':
    case '7M(9)':
    case '6':
    case '6(9)':
      return `${name}: ${motion === 'resolve' ? 'resolve' : 'repousa'} com cor de sétima maior.${moved}`;
    case '7':
      return `${name}: o trítono cria tensão e pede ${res}.`;
    case '7(9)':
    case '7(13)':
      return `${name}: tensão clara, pede ${res} maior.`;
    case '7(b9)':
    case '7(#5)':
      return `${name}: tensão escura, alterada; pede ${res}m ou um engano.`;
    case '7sus4':
      return `${name}: tensão suspensa, a quarta pede a terça antes de resolver em ${res}.`;
    case 'm7(9)':
      return `${name}: a mesma função do m7, com a nona abrindo o som.`;
    case 'm6':
      return `${name}: cor menor com sexta, som de bossa e de "amém".`;
    case 'm':
      return `${name}: tríade menor, a cor mais simples.`;
    default:
      return `${name}: cor menor${motion === 'resolve' ? ' que resolve a tensão' : ' sem tensão'}.${moved}`;
  }
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
      rule.resolvesTo === 'cur'
        ? { root: current.root, quality: current.quality, ...(current.flat ? { flat: true } : {}) }
        : rule.resolvesTo === 'iiOf'
          ? { root: mod12(current.root + 10), quality: '7M' }
          : rule.resolvesTo === 'home'
            ? { root: center.root, quality: center.minor ? 'm7' : '7M' }
            : undefined;
    const move: Move = { to, motion, why: rule.why(ctx), nextCenter, options: [], ...(aim ? { resolvesTo: aim } : {}) };
    // The balloon: the other types of this root, each with its own motion, center and hint.
    // A tension that only passes the tension on (G7 → F#7) offers only other dominant colors: a stable type there would not be a resolution.
    const onlyTension = level === 'tensao' && motion === 'tensiona';
    const others = BALLOON[groupOf(rule.quality)]
      .filter((q) => q !== rule.quality && (!onlyTension || groupOf(q) === 'dom'))
      .map((q): Move => {
        const alt: Chord = { root, quality: q, ...(flat ? { flat: true } : {}) };
        const altMotion = motionOf(level, alt);
        const altCenter = centerAfter(alt, center, { resolution: rule.resolution && groupOf(q) !== 'dom', keep: rule.keep });
        const altName = chordName(alt, altCenter);
        return { to: alt, motion: altMotion, why: hint(alt, altMotion, altName, ctx.target, altCenter, center), nextCenter: altCenter, options: [], ...(aim && groupOf(q) === 'dom' ? { resolvesTo: aim } : {}) };
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
