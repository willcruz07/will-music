export type SeparationRequest = { type: 'separate'; planar: Float32Array; samples: number };
export type SeparationTracks = { instrumental: Float32Array; lead: Float32Array; backing: Float32Array };
export type SeparationResponse =
  | { type: 'progress'; stage: 'models' | 'separate'; done: number; total: number }
  | ({ type: 'result' } & SeparationTracks)
  | { type: 'error'; message: string };
