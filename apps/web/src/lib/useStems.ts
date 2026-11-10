import type { StemMode } from '@will-music/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerSource } from '../components/Player.tsx';
import type { StemsRecord } from './db.ts';
import { exportMixMp3 } from './exportMix.ts';
import { isRunning, subscribeAnalysisFinished } from './jobs.ts';
import { getSessionStems, retainSessionStems, setSessionStems } from './sessionStems.ts';
import { isIOS } from './ios.ts';
import { confirmDialog } from '../ui/Dialog.tsx';
import { type MixTrack, mixVolumes } from './mixer.ts';
import { type SeparationProgress, deleteStemSet, hasUsableWebGpu, listStemSets, selectStemSet, separateSong } from './stems.ts';

const DEFAULT_MIX = (names: string[]): MixTrack[] => names.map((name) => ({ name, volume: 1, muted: false, solo: false }));

/** Stem tracks of a song: separation jobs per mode, the active set, mixer state and the player sources. */
export const useStems = (songId: string, originalUrl?: string) => {
  const [active, setActive] = useState<StemsRecord | null>(null);
  const [modes, setModes] = useState<StemMode[]>([]);
  const [urls, setUrls] = useState<{ name: string; url: string }[] | null>(null);
  const [mix, setMix] = useState<MixTrack[]>([]);
  const [useMix, setUseMix] = useState(false);
  const [progress, setProgress] = useState<(SeparationProgress & { mode: StemMode }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const urlHandles = useRef<{ name: string; url: string }[] | null>(null);
  const generation = useRef(0);
  const [temporaryTracks, setTemporaryTracks] = useState(false);

  const load = useCallback(async () => {
    const current = generation.current;
    const sets = await listStemSets(songId);
    if (generation.current !== current) return;
    const temporary = getSessionStems(songId);
    const record = temporary ?? sets.find((set) => set.mode === 'six');
    setTemporaryTracks(!!temporary);
    setModes([...new Set([...sets.map((s) => s.mode), ...(temporary ? [temporary.mode] : [])])]);
    setActive(record ?? null);
    urlHandles.current?.forEach((u) => URL.revokeObjectURL(u.url));
    urlHandles.current = record ? record.tracks.map((t) => ({ name: t.name, url: URL.createObjectURL(t.blob) })) : null;
    setUrls(urlHandles.current);
    // A new set of tracks starts with every track at full volume.
    setMix((current) => {
      const names = record?.tracks.map((t) => t.name) ?? [];
      return current.length === names.length && current.every((t, i) => t.name === names[i]) ? current : DEFAULT_MIX(names);
    });
  }, [songId]);

  useEffect(() => {
    setUseMix(false);
    const release = retainSessionStems(songId, () => { void load(); });
    void load();
    return () => {
      generation.current++;
      abort.current?.abort();
      release();
      urlHandles.current?.forEach((u) => URL.revokeObjectURL(u.url));
      urlHandles.current = null;
    };
  }, [load]);

  const separate = useCallback(
    async (mode: StemMode = 'six') => {
      if (abort.current || isRunning(songId)) return; // the pipeline owns separation while analyzing
      setError(null);
      const controller = new AbortController();
      abort.current = controller;
      setProgress({ stage: 'models', done: 0, total: 1, mode });
      try {
        if (isIOS() && mode !== 'vocals') {
          const proceed = await confirmDialog({
            title: 'Separar faixas neste aparelho?',
            message: 'A separação usa bastante memória. No iPhone ou iPad, o navegador pode interromper o processamento ou recarregar a página. Proteger o armazenamento não evita esse limite. Para maior estabilidade, separe no computador. Se continuar, mantenha o app aberto em primeiro plano.',
            confirmLabel: 'Continuar neste aparelho',
            cancelLabel: 'Agora não',
          });
          if (!proceed || controller.signal.aborted) return;
        }
        const result = await separateSong(songId, (p) => setProgress({ ...p, mode }), { mode, signal: controller.signal, persist: false });
        if (controller.signal.aborted) return;
        setSessionStems(songId, result.persisted ? undefined : result.record);
        await load();
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Separação de faixas falhou', e);
        setError(e instanceof Error ? e.message : 'A separação falhou.');
      } finally {
        abort.current = null;
        setProgress(null);
      }
    },
    [songId, load],
  );

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeAnalysisFinished((finishedId, succeeded) => {
      if (finishedId !== songId || !succeeded || !originalUrl) return;
      void (async () => {
        const sets = await listStemSets(songId);
        if (getSessionStems(songId)?.mode === 'six' || sets.some((set) => set.mode === 'six')) return;
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
        if (await hasUsableWebGpu(gpu) && mounted) await separate('six');
      })().catch((error: unknown) => {
        if (mounted) setError(error instanceof Error ? error.message : 'Não foi possível preparar a separação automática.');
      });
    });
    return () => { mounted = false; unsubscribe(); };
  }, [songId, originalUrl, separate]);

  const cancel = useCallback(() => abort.current?.abort(), []);

  const select = useCallback(
    async (mode: StemMode) => {
      if (getSessionStems(songId)?.mode === mode) return;
      await selectStemSet(songId, mode);
      await load();
    },
    [songId, load],
  );

  const remove = useCallback(
    async (mode?: StemMode) => {
      const target = mode ?? active?.mode;
      if (!target) return;
      if (getSessionStems(songId)?.mode === target) setSessionStems(songId, undefined);
      else await deleteStemSet(songId, target);
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

  return { hasStems: !!urls, activeMode: active?.mode ?? null, modes, mix, setMix, useMix, setUseMix, progress, error, temporaryTracks, separate, cancel, select, remove, exportMix, sources };
};

export type StemsState = ReturnType<typeof useStems>;
