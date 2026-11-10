import type { Analysis, Chart, Song } from './db.ts';

export type PendingAnalysis = { song: Song; chart: Chart; analysis: Analysis; error?: unknown; sessionOnly?: boolean };
// Small text/timeline results only; no decoded audio or model tensors are retained here.
const pending = new Map<string, PendingAnalysis>();
const owners = new Map<string, number>();
/** A studio page and its background job share text results until both have finished. */
export const retainSessionAnalysis = (songId: string): (() => void) => {
  owners.set(songId, (owners.get(songId) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (owners.get(songId) ?? 1) - 1;
    if (remaining > 0) owners.set(songId, remaining);
    else { owners.delete(songId); if (pending.get(songId)?.sessionOnly) pending.delete(songId); }
  };
};
export const getPendingAnalysis = (songId: string): PendingAnalysis | undefined => pending.get(songId);
export const setPendingAnalysis = (result: PendingAnalysis): void => { pending.set(result.song.id, result); };
export const clearPendingAnalysis = (songId: string): void => { pending.delete(songId); };
