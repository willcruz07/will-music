import type { StemMode } from '@will-music/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerSource } from '../components/Player.tsx';
import type { StemsRecord } from './db.ts';
import { exportMixMp3 } from './exportMix.ts';
import { type MixTrack, mixVolumes } from './mixer.ts';
import { explainQuota, isQuotaError, storageStatus } from './storage.ts';
import { type SeparationProgress, deleteStemSet, getStems, listStemSets, selectStemSet, separateSong } from './stems.ts';

const DEFAULT_MIX = (names: string[]): MixTrack[] => names.map((name) => ({ name, volume: 1, muted: false, solo: false }));

/** Stem tracks of a song: separation jobs per mode, the active set, mixer state and the player sources. */
export const useStems = (songId: string, originalUrl?: string) => {
  const [active, setActive] = useState<StemsRecord | null>(null);
  const [modes, setModes] = useState<StemMode[]>([]);
  const [urls, setUrls] = useState<{ name: string; url: string }[] | null>(null);
  const [mix, setMix] = useState<MixTrack[]>([]);
  const [useMix, setUseMix] = useState(true);
  const [progress, setProgress] = useState<(SeparationProgress & { mode: StemMode }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const [record, sets] = await Promise.all([getStems(songId), listStemSets(songId)]);
    setModes(sets.map((s) => s.mode));
    setActive(record ?? null);
    setUrls((previous) => {
      previous?.forEach((u) => URL.revokeObjectURL(u.url));
      return record ? record.tracks.map((t) => ({ name: t.name, url: URL.createObjectURL(t.blob) })) : null;
    });
    // A new set of tracks starts with every track at full volume.
    setMix((current) => {
      const names = record?.tracks.map((t) => t.name) ?? [];
      return current.length === names.length && current.every((t, i) => t.name === names[i]) ? current : DEFAULT_MIX(names);
    });
  }, [songId]);

  useEffect(() => {
    void load();
    return () => {
      abort.current?.abort();
      setUrls((previous) => (previous?.forEach((u) => URL.revokeObjectURL(u.url)), null));
    };
  }, [load]);

  const separate = useCallback(
    async (mode: StemMode = 'vocals') => {
      if (abort.current) return; // one separation at a time
      setError(null);
      const controller = new AbortController();
      abort.current = controller;
      setProgress({ stage: 'models', done: 0, total: 1, mode });
      try {
        await separateSong(songId, (p) => setProgress({ ...p, mode }), { mode, signal: controller.signal });
        await load();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(isQuotaError(e) ? explainQuota(await storageStatus()) : e instanceof Error ? e.message : 'A separação falhou.');
      } finally {
        abort.current = null;
        setProgress(null);
      }
    },
    [songId, load],
  );

  const cancel = useCallback(() => abort.current?.abort(), []);

  const select = useCallback(
    async (mode: StemMode) => {
      await selectStemSet(songId, mode);
      await load();
    },
    [songId, load],
  );

  const remove = useCallback(
    async (mode?: StemMode) => {
      const target = mode ?? active?.mode;
      if (!target) return;
      await deleteStemSet(songId, target);
      await load();
    },
    [songId, active, load],
  );

  const volumes = mixVolumes(mix);
  const exportMix = useCallback(
    (onStep: (label: string) => void) => {
      if (!active) return Promise.reject(new Error('Separe as faixas antes de salvar uma mixagem.'));
      return exportMixMp3(active.tracks.map((t) => ({ blob: t.blob, volume: volumes[t.name] ?? 1 })), onStep);
    },
    [active, volumes],
  );

  const sources: PlayerSource[] | undefined =
    urls && useMix ? urls.map((u) => ({ name: u.name, src: u.url, volume: volumes[u.name] ?? 1 })) : originalUrl ? [{ name: 'mix', src: originalUrl, volume: 1 }] : undefined;

  return { hasStems: !!urls, activeMode: active?.mode ?? null, modes, mix, setMix, useMix, setUseMix, progress, error, separate, cancel, select, remove, exportMix, sources };
};

export type StemsState = ReturnType<typeof useStems>;
