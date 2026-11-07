import type { ChordSegment, KeyResult } from '@will-music/engine';

export type AnalysisStage = 'models' | 'chords' | 'key';
export type WorkerRequest = { type: 'analyze'; channels: Float32Array[] };
export type WorkerResponse =
  | { type: 'progress'; stage: AnalysisStage; done: number; total: number }
  | { type: 'result'; key: KeyResult; chords: ChordSegment[]; models: Record<string, string> }
  | { type: 'error'; message: string };
