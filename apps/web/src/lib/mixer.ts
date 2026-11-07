export type MixTrack = { name: string; volume: number; muted: boolean; solo: boolean };

/** Effective volume per track: with any solo, only solo tracks play; mute silences. */
export const mixVolumes = (tracks: readonly MixTrack[]): Record<string, number> => {
  const anySolo = tracks.some((t) => t.solo);
  return Object.fromEntries(tracks.map((t) => [t.name, t.muted || (anySolo && !t.solo) ? 0 : Math.max(0, Math.min(1, t.volume))]));
};

/** New currentTime for tracks that drifted from the master by more than `tolerance` seconds, else null. */
// 150 ms: tighter seeks would click repeatedly at 50–150% speed.
export const driftCorrections = (masterTime: number, others: readonly number[], tolerance = 0.15): (number | null)[] =>
  others.map((t) => (Math.abs(t - masterTime) > tolerance ? masterTime : null));
