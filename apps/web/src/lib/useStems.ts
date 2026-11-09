import type { StemMode } from '@will-music/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerSource } from '../components/Player.tsx';
import type { StemsRecord } from './db.ts';
import { exportMixMp3 } from './exportMix.ts';
import { isRunning, subscribeAnalysis } from './jobs.ts';
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
  const [useMix, setUseMix] = useState(true);
  const [progress, setProgress] = useState<(SeparationProgress & { mode: StemMode }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const sets = await listStemSets(songId);
    const record = sets.find((set) => set.mode === 'six');
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
    async (mode: StemMode = 'six') => {
      if (abort.current) return; // one separation at a time
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
        await separateSong(songId, (p) => setProgress({ ...p, mode }), { mode, signal: controller.signal });
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

  // Wait for chord/lyric analysis before starting another heavy model. Existing six-track results are reused.
  useEffect(() => {
    if (!originalUrl) return;
    let cancelled = false;
    let started = false;
    const prepare = async () => {
      if (cancelled || started) return;
      started = true;
      try {
        const sets = await listStemSets(songId);
        if (cancelled) return;
        if (sets.some((set) => set.mode === 'six')) {
          await load();
          return;
        }
        // On iOS, separation starts only from the explicit action in the player, after the memory notice.
        if (isIOS()) return;
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
        // Unsupported devices retain manual access and the original audio without starting a failing job.
        if (!(await hasUsableWebGpu(gpu)) || cancelled) return;
        await separate('six');
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : 'Não foi possível preparar as faixas.');
      }
    };
    const unsubscribe = isRunning(songId)
      ? subscribeAnalysis(songId, (event) => { if (event === 'done') void prepare(); })
      : (void prepare(), () => {});
    return () => {
      cancelled = true;
      unsubscribe();
      abort.current?.abort();
    };
  }, [songId, originalUrl, separate, load]);

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
