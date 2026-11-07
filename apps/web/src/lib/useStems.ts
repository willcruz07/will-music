import { useCallback, useEffect, useState } from 'react';
import type { PlayerSource } from '../components/Player.tsx';
import { type MixTrack, mixVolumes } from './mixer.ts';
import { type SeparationProgress, deleteStems, getStems, separateSong } from './stems.ts';

const DEFAULT_MIX = (names: string[]): MixTrack[] => names.map((name) => ({ name, volume: 1, muted: false, solo: false }));

/** Stem tracks of a song: separation job, mixer state and the player sources (original or mix). */
export const useStems = (songId: string, originalUrl?: string) => {
  const [urls, setUrls] = useState<{ name: string; url: string }[] | null>(null);
  const [mix, setMix] = useState<MixTrack[]>([]);
  const [useMix, setUseMix] = useState(true);
  const [progress, setProgress] = useState<SeparationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const record = await getStems(songId);
    setUrls((previous) => {
      previous?.forEach((u) => URL.revokeObjectURL(u.url));
      return record ? record.tracks.map((t) => ({ name: t.name, url: URL.createObjectURL(t.blob) })) : null;
    });
    if (record) setMix((current) => (current.length ? current : DEFAULT_MIX(record.tracks.map((t) => t.name))));
  }, [songId]);

  useEffect(() => {
    void load();
    return () => setUrls((previous) => (previous?.forEach((u) => URL.revokeObjectURL(u.url)), null));
  }, [load]);

  const separate = useCallback(async () => {
    setError(null);
    setProgress({ stage: 'models', done: 0, total: 1 });
    try {
      await separateSong(songId, setProgress);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A separação falhou.');
    } finally {
      setProgress(null);
    }
  }, [songId, load]);

  const remove = useCallback(async () => {
    await deleteStems(songId);
    setMix([]);
    await load();
  }, [songId, load]);

  const volumes = mixVolumes(mix);
  const sources: PlayerSource[] | undefined =
    urls && useMix ? urls.map((u) => ({ name: u.name, src: u.url, volume: volumes[u.name] ?? 1 })) : originalUrl ? [{ name: 'mix', src: originalUrl, volume: 1 }] : undefined;

  return { hasStems: !!urls, mix, setMix, useMix, setUseMix, progress, error, separate, remove, sources };
};
