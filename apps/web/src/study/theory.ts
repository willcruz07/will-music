import { ROOTS, pcOf, spellNote } from '../lib/chordTheory.ts';
import type { SynthEvent } from '../lib/synth.ts';

// ---- Roman numerals ----

const DEGREES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];

/** A double sharp or flat (Bbb, F##) becomes the plain note the app can draw and play (A, G). */
const plain = (note: string) => (/^[A-G](bb|##)$/u.test(note) ? ROOTS[pcOf(note)]! : note);

const rootOf = (chord: string) => /^[A-G][#b]*/u.exec(chord)?.[0] ?? 'C';

/**
 * A degree of the key as a chord in Brazilian notation: ii7 → Dm7, V7 → G7, I7M → C7M in C;
 * lowercase is minor, "ø" half-diminished, "°" diminished; b/# move the degree (bVII, bVI7M);
 * "X/Y" is the X of degree Y (V7/ii → A7) and "subV7" the tritone substitute (Db7).
 */
export const romanToChord = (roman: string, key: string, mode: 'major' | 'minor' = 'major'): string => {
  const slash = roman.indexOf('/');
  if (slash > 0) return romanToChord(roman.slice(0, slash), rootOf(romanToChord(roman.slice(slash + 1), key, mode)), 'major');
  if (roman.startsWith('subV')) return `${plain(spellNote(key, 1, 1))}${roman.slice(4)}`;
  const m = /^(b|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/u.exec(roman);
  if (!m) throw new Error(`Grau inválido: ${roman}`);
  const [, accidental = '', numeral, rest = ''] = m;
  const index = DEGREES.indexOf(numeral!.toUpperCase());
  const semis = (mode === 'major' ? MAJOR : NATURAL_MINOR)[index]! + (accidental === 'b' ? -1 : accidental === '#' ? 1 : 0);
  const root = plain(spellNote(key, (semis + 12) % 12, index));
  if (numeral === numeral!.toUpperCase()) return `${root}${rest}`;
  if (rest.startsWith('ø')) return `${root}m7(b5)${rest.slice(1).replace(/^7/u, '')}`;
  if (rest.startsWith('°')) return `${root}${rest}`;
  return `${root}m${rest}`;
};

// ---- Scales ----

export type ScaleInfo = { name: string; family: 'Maior e modos' | 'Menores' | 'Jazz e simétricas' | 'Pentatônicas e blues' | 'Orientais e árabes' | 'Indianas (thaats)'; steps: number[]; degrees: number[]; about: string };

const seven = [0, 1, 2, 3, 4, 5, 6];

/** Scales used across the study tracks: steps in semitones, degrees as letter steps (for correct spelling). */
export const SCALE_LIBRARY = {
  major: { name: 'Maior (jônio)', family: 'Maior e modos', steps: [0, 2, 4, 5, 7, 9, 11], degrees: seven, about: 'A base da harmonia tonal. Na Índia é o thaat Bilawal.' },
  dorian: { name: 'Dórico', family: 'Maior e modos', steps: [0, 2, 3, 5, 7, 9, 10], degrees: seven, about: 'Menor com a sexta maior: som menor "luminoso" (funk, soul, Santana). Thaat Kafi.' },
  phrygian: { name: 'Frígio', family: 'Maior e modos', steps: [0, 1, 3, 5, 7, 8, 10], degrees: seven, about: 'Menor com a segunda menor: som espanhol, escuro. Thaat Bhairavi.' },
  lydian: { name: 'Lídio', family: 'Maior e modos', steps: [0, 2, 4, 6, 7, 9, 11], degrees: seven, about: 'Maior com a quarta aumentada: som "flutuante", de trilha de cinema. Thaat Kalyan (raga Yaman).' },
  mixolydian: { name: 'Mixolídio', family: 'Maior e modos', steps: [0, 2, 4, 5, 7, 9, 10], degrees: seven, about: 'Maior com a sétima menor: o som do acorde dominante, do blues-rock e do baião. Thaat Khamaj.' },
  minor: { name: 'Menor natural (eólio)', family: 'Menores', steps: [0, 2, 3, 5, 7, 8, 10], degrees: seven, about: 'A menor relativa da maior. Thaat Asavari.' },
  locrian: { name: 'Lócrio', family: 'Maior e modos', steps: [0, 1, 3, 5, 6, 8, 10], degrees: seven, about: 'Começa no sétimo grau da maior: é a escala do acorde meio-diminuto (m7(b5)).' },
  harmonicMinor: { name: 'Menor harmônica', family: 'Menores', steps: [0, 2, 3, 5, 7, 8, 11], degrees: seven, about: 'Menor com a sétima elevada: cria o V7 do tom menor.' },
  melodicMinor: { name: 'Menor melódica', family: 'Menores', steps: [0, 2, 3, 5, 7, 9, 11], degrees: seven, about: 'Menor com sexta e sétima maiores; base de várias escalas do jazz (alterada, lídio dominante).' },
  phrygianDominant: { name: 'Frígio dominante (Hijaz)', family: 'Orientais e árabes', steps: [0, 1, 4, 5, 7, 8, 10], degrees: seven, about: '5º modo da menor harmônica: o som árabe, flamenco e judaico (Hijaz, Freygish).' },
  lydianDominant: { name: 'Lídio dominante', family: 'Jazz e simétricas', steps: [0, 2, 4, 6, 7, 9, 10], degrees: seven, about: 'Para dominantes com #11 (o subV7); 4º modo da menor melódica.' },
  altered: { name: 'Alterada (superlócrio)', family: 'Jazz e simétricas', steps: [0, 1, 3, 4, 6, 8, 10], degrees: [0, 1, 1, 2, 3, 4, 6], about: 'Para o dominante alterado (7(b9), 7(#9), 7(b13)); 7º modo da menor melódica.' },
  bebopDominant: { name: 'Bebop dominante', family: 'Jazz e simétricas', steps: [0, 2, 4, 5, 7, 9, 10, 11], degrees: [0, 1, 2, 3, 4, 5, 6, 6], about: 'Mixolídio com a sétima maior de passagem: as notas do acorde caem nos tempos.' },
  wholeTone: { name: 'Tons inteiros', family: 'Jazz e simétricas', steps: [0, 2, 4, 6, 8, 10], degrees: [0, 1, 2, 3, 4, 5], about: 'Só tons: para o 7(#5) e o 7(b13); som de sonho (Debussy).' },
  diminishedHW: { name: 'Diminuta semitom-tom', family: 'Jazz e simétricas', steps: [0, 1, 3, 4, 6, 7, 9, 10], degrees: [0, 1, 2, 2, 3, 4, 5, 6], about: 'Para o dominante 7(b9) com 13: alterna semitom e tom.' },
  diminishedWH: { name: 'Diminuta tom-semitom', family: 'Jazz e simétricas', steps: [0, 2, 3, 5, 6, 8, 9, 11], degrees: [0, 1, 2, 3, 4, 5, 5, 6], about: 'Para o acorde diminuto (°7): alterna tom e semitom.' },
  majorPentatonic: { name: 'Pentatônica maior', family: 'Pentatônicas e blues', steps: [0, 2, 4, 7, 9], degrees: [0, 1, 2, 4, 5], about: 'Cinco notas sem semitons: segura sobre o acorde maior e muito cantável.' },
  minorPentatonic: { name: 'Pentatônica menor', family: 'Pentatônicas e blues', steps: [0, 3, 5, 7, 10], degrees: [0, 2, 3, 4, 6], about: 'A escala dos solos de rock e blues.' },
  blues: { name: 'Blues', family: 'Pentatônicas e blues', steps: [0, 3, 5, 6, 7, 10], degrees: [0, 2, 3, 4, 4, 6], about: 'Pentatônica menor com a quinta diminuta (a "blue note").' },
  hungarianMinor: { name: 'Menor húngara (cigana)', family: 'Orientais e árabes', steps: [0, 2, 3, 6, 7, 8, 11], degrees: seven, about: 'Menor harmônica com a quarta aumentada: duas segundas aumentadas, som do Leste Europeu.' },
  doubleHarmonic: { name: 'Dupla harmônica (bizantina)', family: 'Orientais e árabes', steps: [0, 1, 4, 5, 7, 8, 11], degrees: seven, about: 'Segunda menor e sétima maior: o som "do deserto" (maqam Hijaz Kar). Igual ao thaat Bhairav.' },
  hirajoshi: { name: 'Hirajoshi', family: 'Orientais e árabes', steps: [0, 2, 3, 7, 8], degrees: [0, 1, 2, 4, 5], about: 'Pentatônica japonesa usada no koto.' },
  inSen: { name: 'In-sen', family: 'Orientais e árabes', steps: [0, 1, 5, 7, 10], degrees: [0, 1, 3, 4, 6], about: 'Pentatônica japonesa do shakuhachi, com a segunda menor.' },
  kumoi: { name: 'Kumoi', family: 'Orientais e árabes', steps: [0, 2, 3, 7, 9], degrees: [0, 1, 2, 4, 5], about: 'Pentatônica japonesa menor, mais suave que a hirajoshi.' },
  bhairav: { name: 'Bhairav', family: 'Indianas (thaats)', steps: [0, 1, 4, 5, 7, 8, 11], degrees: seven, about: 'Thaat da manhã: segunda e sexta menores, terça e sétima maiores.' },
  poorvi: { name: 'Poorvi', family: 'Indianas (thaats)', steps: [0, 1, 4, 6, 7, 8, 11], degrees: seven, about: 'Thaat do entardecer: segunda e sexta menores com quarta aumentada.' },
  marwa: { name: 'Marwa', family: 'Indianas (thaats)', steps: [0, 1, 4, 6, 7, 9, 11], degrees: seven, about: 'Thaat do pôr do sol: segunda menor e quarta aumentada; som de expectativa.' },
  todi: { name: 'Todi', family: 'Indianas (thaats)', steps: [0, 1, 3, 6, 7, 8, 11], degrees: seven, about: 'Thaat da manhã, intenso: segunda, terça e sexta menores com quarta aumentada.' },
} satisfies Record<string, ScaleInfo>;

export type ScaleId = keyof typeof SCALE_LIBRARY;

export const spellScale = (root: string, id: ScaleId): string[] => {
  const s: ScaleInfo = SCALE_LIBRARY[id];
  return s.steps.map((step, i) => spellNote(root, step, s.degrees[i]!));
};

/**
 * A scale in one hand position (five frets, from one below `startFret`, so the run never
 * skips a note), string by string from the lowest: the frets to play on each string, ascending, and
 * which of them are the root. A note already reached on the string below is not repeated.
 */
export const fretboardBox = (rootPc: number, steps: readonly number[], tuning: readonly number[], startFret: number) => {
  const pcs = new Set(steps.map((s) => (rootPc + s) % 12));
  let last = -Infinity;
  return tuning.map((open, i) => {
    const frets: number[] = [];
    const low = Math.max(0, startFret - 1);
    for (let f = low; f <= low + 4; f++)
      if (pcs.has((open + f) % 12) && open + f > last) {
        frets.push(f);
        last = open + f;
      }
    return { string: tuning.length - i, frets, roots: frets.filter((f) => (open + f) % 12 === rootPc) };
  });
};

/** Where to start the box so it holds the root on the lowest string (a common first position). */
export const firstBoxFret = (rootPc: number, lowString = 40): number => {
  return (((rootPc - lowString) % 12) + 12) % 12;
};

// ---- Rhythm ----

export type DrumSound = 'kick' | 'snare' | 'hihat';
export type RhythmPattern = { bpm: number; steps: number; perBeat?: number; tracks: { sound: DrumSound; pattern: string; label?: string }[] };

/** Step patterns ("x" hit, "." rest) to drum hits: a step is a sixteenth (or 1/perBeat of a beat). */
export const rhythmEvents = (r: RhythmPattern, repeats = 1): SynthEvent[] => {
  const step = 60 / r.bpm / (r.perBeat ?? 4);
  const out: SynthEvent[] = [];
  for (let rep = 0; rep < repeats; rep++) {
    for (const t of r.tracks) {
      [...t.pattern].forEach((c, i) => {
        if (c === 'x' || c === 'X' || c === 'o') out.push({ time: (rep * r.steps + i) * step, dur: 0.15, drum: t.sound, ...(c === 'X' ? { velocity: 1 } : c === 'o' ? { velocity: 0.25 } : { velocity: 0.65 }) });
      });
    }
  }
  return out.sort((a, z) => a.time - z.time);
};

// ---- Tablature ----

const STANDARD = [64, 59, 55, 50, 45, 40]; // string 1 (high e) → 6 (low E)

/** Reads a six-line ASCII tab (high e first) into notes in playing order. */
export const parseTab = (tab: string, tuning: readonly number[] = STANDARD): { string: number; fret: number; column: number; midi: number }[] => {
  const lines = tab.split('\n').filter((l) => l.includes('|') || l.includes('-'));
  const notes: { string: number; fret: number; column: number; midi: number }[] = [];
  lines.forEach((line, i) => {
    const body = line.replace(/^[A-Ga-g][#b]?\|?/u, '');
    for (const m of body.matchAll(/\d{1,2}/gu)) {
      const string = i + 1;
      const fret = Number(m[0]);
      notes.push({ string, fret, column: m.index, midi: (tuning[i] ?? 40) + fret });
    }
  });
  return notes.sort((a, z) => a.column - z.column || z.string - a.string);
};

export const tabEvents = (tab: string, bpm = 90, tuning?: readonly number[]): SynthEvent[] => {
  const notes = parseTab(tab, tuning);
  const columns = [...new Set(notes.map((n) => n.column))];
  const step = 60 / bpm / 2; // each written note an eighth
  return notes.map((n) => ({ time: columns.indexOf(n.column) * step, dur: step * 1.6, pitch: n.midi }));
};

export const pcOfNote = pcOf;

const STRING_NAMES: Record<number, string> = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };

/** A hand-position box as tab, one note per column from the lowest string up (high e on top). */
export const boxTab = (box: { string: number; frets: number[] }[], names: Record<number, string> = STRING_NAMES): string => {
  const seq = [...box].sort((a, z) => z.string - a.string).flatMap((s) => s.frets.map((fret) => ({ string: s.string, fret })));
  return [1, 2, 3, 4, 5, 6]
    .filter((st) => box.some((b) => b.string === st))
    .map((st) => `${names[st]}|-${seq.map((n) => (n.string === st ? String(n.fret).padEnd(3, '-') : '---')).join('')}|`)
    .join('\n');
};
