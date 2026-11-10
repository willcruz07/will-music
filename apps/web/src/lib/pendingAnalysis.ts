import type { Analysis, Chart, Song } from './db.ts';

export type PendingAnalysis = { song: Song; chart: Chart; analysis: Analysis; error?: unknown };
// Small text/timeline results only; no decoded audio or model tensors are retained here.
const pending = new Map<string, PendingAnalysis>();
export const getPendingAnalysis = (songId: string): PendingAnalysis | undefined => pending.get(songId);
export const setPendingAnalysis = (result: PendingAnalysis): void => { pending.set(result.song.id, result); };
export const clearPendingAnalysis = (songId: string): void => { pending.delete(songId); };
