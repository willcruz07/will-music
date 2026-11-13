import type { RhythmPattern, ScaleId } from './theory.ts';
import type { StudyScore } from './notation.ts';

export type Level = 'iniciante' | 'intermediario' | 'avancado' | 'pro';
export const LEVELS: { id: Level; label: string; about: string }[] = [
  { id: 'iniciante', label: 'Iniciante', about: 'Para quem está começando: os fundamentos, passo a passo.' },
  { id: 'intermediario', label: 'Intermediário', about: 'Para quem já toca: o vocabulário que deixa o som mais rico.' },
  { id: 'avancado', label: 'Avançado', about: 'Para ir além: a linguagem de quem arranja e improvisa.' },
  { id: 'pro', label: 'Pro', about: 'Para dominar: técnicas de rearmonização, arranjo e estilo.' },
];

export type TrackId = 'harmonia' | 'ritmo' | 'improviso' | 'escalas' | 'canto' | 'violao' | 'teclado' | 'bateria' | 'estilos' | 'cavaquinho' | 'partituras';

/** The parts a lesson is made of; the interactive ones play with the app's own synth. */
export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'explanation'; context: string; simple: string; example: string }
  | { kind: 'list'; title?: string; items: string[] }
  | { kind: 'tip'; text: string; tone?: 'tip' | 'warning' }
  | { kind: 'chords'; chords: string[]; caption?: string }
  /** Degrees as Roman numerals (ii7, V7, I7M, V7/ii, subV7, bVII…), shown and played in any key. */
  | { kind: 'progression'; name?: string; degrees: string[]; key?: string; mode?: 'major' | 'minor'; caption?: string; bpm?: number }
  | { kind: 'scale'; scale: ScaleId; root?: string; caption?: string; instrument?: 'violao' | 'teclado' | 'cavaquinho' }
  | { kind: 'intervals'; root?: string; semitones: number[]; caption?: string }
  | { kind: 'rhythm'; caption?: string; sticking?: string; pattern: RhythmPattern }
  | { kind: 'tab'; caption?: string; tab: string; bpm?: number; tuning?: number[] }
  | { kind: 'notation'; score: StudyScore; caption: string }
  | { kind: 'quiz'; question: string; options: string[]; answer: number; explanation: string }
  | { kind: 'exercise'; title?: string; steps: string[] };

export type Lesson = { id: string; track: TrackId; level: Level; title: string; summary: string; blocks: Block[]; objective?: string; prerequisites?: string[]; checkpoints?: string[] };

export type Track = { id: TrackId; title: string; group: 'Teoria e harmonia' | 'Voz' | 'Instrumentos' | 'Estilos'; about: string };
