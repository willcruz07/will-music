export type SeparationRequest = { type: 'separate'; planar: Float32Array; samples: number };
/** 16-bit WAV files, encoded in the worker so the main thread never holds float copies. */
export type SeparationTracks = { instrumental: ArrayBuffer; lead: ArrayBuffer; backing: ArrayBuffer };
export type SeparationResponse =
  | { type: 'progress'; stage: 'models' | 'separate'; done: number; total: number }
  | ({ type: 'result' } & SeparationTracks)
  | { type: 'error'; message: string };
