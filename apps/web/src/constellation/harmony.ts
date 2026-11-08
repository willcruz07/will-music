import { spellPitch } from '../lib/transpose.ts';

/**
 * The harmony engine of the Constelação de acordes: for a chord and a tonal center, which chords can come
 * next, with the function of each one and a one-line reason. It reasons by function (tonic, subdominant,
 * dominant), shared tritones, ii–V chains and the cycle of fourths, never by "being in the scale".
 */

export type Quality = '' | 'm' | '7M' | '6' | 'm7' | 'm6' | '7' | 'm7(b5)' | '°7' | 'm(7M)' | '7sus4';
/** `root` is a pitch class (0 = C). `flat` forces a flat spelling (tritone subs and borrowed chords). */
export type Chord = { root: number; quality: Quality; flat?: boolean };
export type Center = { root: number; minor: boolean };
export type Family = 'tonica' | 'subdominante' | 'dominante' | 'alterado';
export type MoveKind = 'cadencia' | 'tritono' | 'subV' | 'iiV' | 'relativo' | 'secundario' | 'cadeia' | 'emprestimo' | 'diminuto' | 'viraDominante' | 'volta';
export type Move = { to: Chord; kind: MoveKind; family: Family; why: string; nextCenter: Center; variants: string[] };

export const QUALITIES: readonly Quality[] = ['7M', '', '6', 'm7', 'm', 'm6', 'm(7M)', '7', '7sus4', 'm7(b5)', '°7'];

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

/** Identity of a chord by pitch, not by spelling: C#7 and Db7 are the same star. */
export const chordKey = (c: Chord): string => `${mod12(c.root)}:${c.quality}`;

export const centerName = (center: Center): string => (center.minor ? MINOR_KEYS : MAJOR_KEYS)[mod12(center.root)]!;

export const chordName = (c: Chord, center: Center): string => `${spellPitch(mod12(c.root), c.flat ? true : centerName(center))}${c.quality}`;

export const parseChord = (name: string): Chord | null => {
  const m = /^([A-G])([#b]?)(.*)$/u.exec(name.trim());
  if (!m || !(QUALITIES as readonly string[]).includes(m[3]!)) return null;
  const root = mod12(NOTE_PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
  return { root, quality: m[3] as Quality, ...(m[2] === 'b' ? { flat: true } : {}) };
};

type Role = 'tonic' | 'minor' | 'dominant' | 'halfDim' | 'dim';
const roleOf = (q: Quality): Role =>
  q === '7' || q === '7sus4' ? 'dominant' : q === 'm7(b5)' ? 'halfDim' : q === '°7' ? 'dim' : q === 'm' || q === 'm7' || q === 'm6' || q === 'm(7M)' ? 'minor' : 'tonic';

/** The center a starting chord implies: a dominant points to its resolution, a iiø to its minor key. */
export const startCenter = (c: Chord): Center => {
  switch (roleOf(c.quality)) {
    case 'minor':
      return { root: c.root, minor: true };
    case 'dominant':
      return { root: mod12(c.root + 5), minor: false };
    case 'halfDim':
      return { root: mod12(c.root + 10), minor: true };
    case 'dim':
      return { root: mod12(c.root + 1), minor: false };
    default:
      return { root: c.root, minor: false };
  }
};

/** Degrees (from the center) that carry a major chord: where a dominant resolves to 7M instead of m7. */
const majorDegree = (pc: number, center: Center) => (center.minor ? [3, 8, 10] : [0, 5, 7]).includes(mod12(pc - center.root));

/** cur: current chord · to: destination · target: a fourth above the destination · res: where the current chord resolves. */
type Names = { cur: string; to: string; target: string; res: string; center: string };
type Rule = { at: number; quality: Quality | 'resolve'; kind: MoveKind; family: Family; flat?: boolean; why: (n: Names) => string };

const R = (at: number, quality: Rule['quality'], kind: MoveKind, family: Family, why: Rule['why'], flat = false): Rule => ({ at, quality, kind, family, why, flat });

const RULES: Record<Role, Rule[]> = {
  tonic: [
    R(7, '7', 'cadencia', 'dominante', (n) => `${n.to} é o dominante de ${n.cur}: cria a tensão que pede a volta.`),
    R(11, 'm7(b5)', 'tritono', 'dominante', (n) => `${n.to} tem o mesmo trítono do dominante de ${n.cur}: faz a função dele com outra cor.`),
    R(1, '7', 'subV', 'dominante', (n) => `${n.to} é o substituto de trítono: mesmo trítono do dominante, o baixo desce meio tom até ${n.cur}.`, true),
    R(2, 'm7', 'iiV', 'subdominante', (n) => `${n.to} é o ii: prepara o dominante e abre a cadência ii–V–I.`),
    R(9, 'm7', 'relativo', 'tonica', (n) => `${n.to} é o relativo menor: mesma função de repouso, cor mais escura.`),
    R(4, 'm7', 'relativo', 'tonica', (n) => `${n.to} divide três notas com ${n.cur}: troca suave, quase a mesma função.`),
    R(9, '7', 'secundario', 'alterado', (n) => `${n.to} é o dominante de ${n.target}: traz uma nota de fora do tom e puxa para o ii.`),
    R(5, 'm6', 'emprestimo', 'subdominante', (n) => `${n.to} vem do tom menor: o subdominante menor, aquele som de "amém".`, true),
    R(0, '7', 'viraDominante', 'alterado', (n) => `${n.to}: a tônica ganha sétima menor e vira dominante de ${n.target}.`),
    R(1, '°7', 'diminuto', 'alterado', (n) => `${n.to} é diminuto de passagem: sobe meio tom e liga ${n.cur} ao ii.`),
    R(10, '7', 'emprestimo', 'subdominante', (n) => `${n.to} vem do modo mixolídio: o bVII7, som de gospel e rock.`, true),
  ],
  minor: [
    R(5, '7', 'iiV', 'dominante', (n) => `${n.cur} funciona como ii e ${n.to} como V: o ii–V que leva a ${n.target}.`),
    R(11, '7', 'subV', 'dominante', (n) => `${n.to} é o substituto de trítono do V: o baixo desce em semitons.`, true),
    R(5, 'm7', 'cadeia', 'subdominante', (n) => `${n.to} é o ii de ${n.target}: a cadeia de ii andando pelo ciclo de quartas.`),
    R(7, '7', 'secundario', 'alterado', (n) => `${n.to} é o dominante de ${n.cur}: reforça o acorde com uma nota de fora.`),
    R(3, '7M', 'relativo', 'tonica', (n) => `${n.to} é o relativo maior: as mesmas notas, com cor clara.`),
  ],
  dominant: [
    R(5, 'resolve', 'cadencia', 'tonica', (n) => `${n.cur} resolve em ${n.to}: a tensão do trítono se desfaz.`),
    R(2, 'm7', 'relativo', 'tonica', (n) => `${n.to}: cadência de engano, em vez de ${n.res} vai para o relativo menor.`),
    R(5, '7', 'cadeia', 'dominante', (n) => `${n.to}: dominante que puxa outro dominante pelo ciclo de quartas.`),
    R(6, '7', 'subV', 'dominante', (n) => `${n.to} tem o mesmo trítono de ${n.cur}: troca pelo substituto de trítono.`, true),
    R(4, 'm7(b5)', 'tritono', 'dominante', (n) => `${n.to} é ${n.cur} com nona e sem fundamental: mesmo trítono, outra cor.`),
  ],
  halfDim: [
    R(5, '7', 'iiV', 'dominante', (n) => `${n.cur} é o iiø e ${n.to} o V: o ii–V do tom menor.`),
    R(1, '7M', 'tritono', 'tonica', (n) => `${n.cur} tem o trítono do dominante de ${n.to}: resolve subindo meio tom.`),
    R(3, 'm6', 'relativo', 'subdominante', (n) => `${n.to} tem as mesmas notas de ${n.cur}: só muda o baixo.`),
    R(8, '7', 'tritono', 'dominante', (n) => `${n.cur} é ${n.to} com nona e sem fundamental: dá para trocar um pelo outro.`),
    R(11, '7', 'subV', 'dominante', (n) => `${n.to} é o substituto de trítono do V: mesmo trítono, outro baixo.`, true),
  ],
  dim: [
    R(1, 'm7', 'diminuto', 'tonica', (n) => `${n.cur} sobe meio tom e chega em ${n.to}: diminuto de passagem.`),
    ...[8, 11, 2, 5].map((at) => R(at, '7', 'tritono', 'dominante', (n) => `${n.cur} é ${n.to}(b9) sem a fundamental: pode virar esse dominante.`)),
  ],
};

/** The tonic of a minor center: the degrees of the minor key (with the V7 of the harmonic minor). */
const MINOR_TONIC: Rule[] = [
  R(2, 'm7(b5)', 'iiV', 'subdominante', (n) => `${n.to} é o iiø do tom menor: abre o ii–V–i.`),
  R(7, '7', 'cadencia', 'dominante', (n) => `${n.to} é o V7 da menor harmônica: o dominante que pede ${n.cur}.`),
  R(8, '7M', 'relativo', 'subdominante', (n) => `${n.to} é o VI: subdominante com cor maior dentro do tom menor.`),
  R(10, '7', 'secundario', 'dominante', (n) => `${n.to} é o VII7: dominante do relativo maior.`),
  R(5, 'm7', 'iiV', 'subdominante', (n) => `${n.to} é o iv: o subdominante do tom menor.`),
  R(3, '7M', 'relativo', 'tonica', (n) => `${n.to} é o relativo maior: as mesmas notas, com cor clara.`),
  R(1, '7', 'subV', 'dominante', (n) => `${n.to} é o substituto de trítono do V: o baixo desce meio tom até ${n.cur}.`, true),
];

const variantsOf =(name: string, quality: Quality): string[] => (quality === '7' ? ['(9)', '(13)', '(b9)', '(#5)'].map((t) => `${name}${t}`) : []);

const centerRules = (center: Center): Rule[] => [
  R(0, center.minor ? 'm7' : '7M', 'volta', 'tonica', (n) => `${n.to} é a tônica do centro ${n.center}: a volta para casa.`),
  R(7, '7', 'cadencia', 'dominante', (n) => `${n.to} é o dominante do centro ${n.center}: prepara a volta para casa.`),
  R(2, center.minor ? 'm7(b5)' : 'm7', 'iiV', 'subdominante', (n) => `${n.to} é o ii do centro ${n.center}: começa um ii–V–I.`),
];

const MIN_ORBIT = 6;
const MAX_ORBIT = 10;

export const neighbors = (current: Chord, center: Center): Move[] => {
  const moves: Move[] = [];
  const seen = new Set([chordKey(current)]);
  const cur = chordName(current, center);
  const res = chordName({ root: mod12(current.root + 5), quality: '' }, center);
  const add = (rule: Rule, base: number, limit: number) => {
    if (moves.length >= limit) return;
    const root = mod12(base + rule.at);
    const quality: Quality = rule.quality === 'resolve' ? (majorDegree(root, center) ? '7M' : 'm7') : rule.quality;
    const to: Chord = { root, quality, ...(rule.flat ? { flat: true } : {}) };
    if (seen.has(chordKey(to))) return;
    seen.add(chordKey(to));
    const name = chordName(to, center);
    const target = chordName({ root: mod12(root + 5), quality: '' }, center);
    let why = rule.why({ cur, to: name, target, res, center: centerName(center) });
    let nextCenter = center;
    // Tonicization: a dominant that resolves somewhere other than home makes that chord the new center.
    if (rule.quality === 'resolve' && root !== center.root) {
      nextCenter = { root, minor: quality === 'm7' };
      why += ` O centro tonal passa a ser ${centerName(nextCenter)}.`;
    }
    moves.push({ to, kind: rule.kind, family: rule.family, why, nextCenter, variants: variantsOf(name, quality) });
  };
  const minorTonic = center.minor && current.root === center.root && roleOf(current.quality) === 'minor';
  for (const rule of minorTonic ? MINOR_TONIC : RULES[roleOf(current.quality)]) add(rule, current.root, MAX_ORBIT);
  for (const rule of centerRules(center)) add(rule, center.root, MIN_ORBIT);
  return moves;
};
