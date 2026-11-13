import { CANTO } from './content/canto.ts';
import { ESCALAS } from './content/escalas.ts';
import { ESTILOS } from './content/estilos.ts';
import { HARMONIA } from './content/harmonia.ts';
import { IMPROVISO } from './content/improviso.ts';
import { BATERIA, TECLADO, VIOLAO } from './content/instrumentos.ts';
import { RITMO } from './content/ritmo.ts';
import { CAVAQUINHO } from './content/cavaquinho.ts';
import { PARTITURAS } from './content/partituras.ts';
import { APROFUNDAMENTO } from './content/aprofundamento.ts';
import { LEVELS, type Lesson, type Track, type TrackId } from './types.ts';
import { explainLesson } from './explanations/index.ts';

/** The study tracks, grouped so theory, voice, instruments and styles stay apart. */
export const TRACKS: Track[] = [
  { id: 'harmonia', title: 'Harmonia aplicada', group: 'Teoria e harmonia', about: 'Da tríade à rearmonização: campo harmônico, funções, 2-5-1, trítono, empréstimo modal, jazz, clusters.' },
  { id: 'ritmo', title: 'Ritmo e groove', group: 'Teoria e harmonia', about: 'Pulso, subdivisão, síncope, tercinas, pocket e polirritmia.' },
  { id: 'partituras', title: 'Leitura de partituras', group: 'Teoria e harmonia', about: 'Do pentagrama à leitura de conjunto: notas, figuras, pausas, claves, compassos e expressão, com escrita e áudio.' },
  { id: 'escalas', title: 'Escalas do mundo', group: 'Teoria e harmonia', about: 'Maior e modos, menores, simétricas, orientais, árabes e indianas, com digitação no braço.' },
  { id: 'improviso', title: 'Improvisação e frases', group: 'Teoria e harmonia', about: 'Pentatônica, notas-alvo, cromatismo, motivos, bebop e cores exóticas.' },
  { id: 'canto', title: 'Canto', group: 'Voz', about: 'Respiração, afinação, aquecimento, articulação, ressonância, extensão, mix, melismas e drivers.' },
  { id: 'violao', title: 'Violão e guitarra', group: 'Instrumentos', about: 'Acordes, batidas, pestana, CAGED, pentatônica no braço, técnicas e licks.' },
  { id: 'teclado', title: 'Teclado', group: 'Instrumentos', about: 'Mãos, inversões, voicings shell e rootless, gospel chords e rearmonização.' },
  { id: 'cavaquinho', title: 'Cavaquinho', group: 'Instrumentos', about: 'Afinação, palhetada, levadas, inversões, tensões em quatro cordas, samba, pagode, choro e arranjo.' },
  { id: 'bateria', title: 'Bateria', group: 'Instrumentos', about: 'Rudimentos, grooves, viradas, ghost notes, samba e gospel chops.' },
  { id: 'estilos', title: 'Estilos musicais', group: 'Estilos', about: 'Louvor, bossa nova, samba e pagode, MPB, rock, funk, R&B e gospel americano.' },
];

export const LESSONS: Lesson[] = [...HARMONIA, ...RITMO, ...ESCALAS, ...IMPROVISO, ...CANTO, ...VIOLAO, ...TECLADO, ...BATERIA, ...ESTILOS, ...CAVAQUINHO, ...PARTITURAS, ...APROFUNDAMENTO].map(explainLesson);

const levelOrder = (l: Lesson) => LEVELS.findIndex((x) => x.id === l.level);
// Insert foundations where they are needed without renaming old lesson IDs or resetting progress.
const BEFORE: Record<string, string> = { 'h-intervalos-base': 'h-triades', 'r-leitura-figuras': 'r-subdivisao' };
const lessonOrder = (l: Lesson, index: number) => BEFORE[l.id] ? LESSONS.findIndex(x => x.id === BEFORE[l.id]) - 0.5 : index;

/** Lessons of a track in study order: by level, keeping the written order inside each level. */
export const trackLessons = (track: TrackId): Lesson[] =>
  LESSONS.map((l, i) => ({ l, i }))
    .filter(({ l }) => l.track === track)
    .sort((a, z) => levelOrder(a.l) - levelOrder(z.l) || lessonOrder(a.l, a.i) - lessonOrder(z.l, z.i))
    .map(({ l }) => l);

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);

const DONE_KEY = 'wm-study-done';
const LAST_KEY = 'wm-study-last';

/** Lessons marked as studied on this device (a per-device convenience). */
export const readDone = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
};
export const setDone = (id: string, done: boolean): void => {
  const all = readDone();
  if (done) all.add(id);
  else all.delete(id);
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...all]));
  } catch {
    /* per-device convenience only */
  }
};
export const readLast = (): string | null => {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
};
export const setLast = (id: string): void => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* per-device convenience only */
  }
};
