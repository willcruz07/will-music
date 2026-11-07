import type { StemMode } from '@will-music/engine';

export type SeparationRequest = { type: 'separate'; planar: Float32Array; samples: number; mode: StemMode };
/** MP3 files per track name, encoded in the worker so the main thread never holds float copies. */
export type SeparationTracks = Record<string, ArrayBuffer>;
export type SeparationResponse =
  | { type: 'progress'; stage: 'models' | 'separate'; done: number; total: number }
  | { type: 'result'; tracks: SeparationTracks }
  | { type: 'error'; message: string };
