import { isIOS } from './ios.ts';
import { isMobileStudio, MOBILE_TRACKS_NOTICE } from './studioDevice.ts';
import { MODELS, type ModelId, SEPARATION_GEOMETRY, STEM_MODES, type StemMode, modelVersion, toStereoPlanar } from '@will-music/engine';
import type { SeparationResponse, SeparationTracks } from '../worker/separationProtocol.ts';
import { type StemName, type StemsRecord, db, now } from './db.ts';
import { listCachedModels } from './models.ts';
import { type StorageApi, ensureRoom, formatBytes, isQuotaError, requestPersistence, storageStatus, explainQuota } from './storage.ts';

export const NO_WEBGPU = 'A separação de faixas precisa de um navegador com WebGPU (Chrome ou Edge atualizados).';

export type SeparationProgress = { stage: 'models' | 'separate'; done: number; total: number };

/** What each separation type gives, what it downloads the first time, and roughly how long it takes. */
/** The 4/6-track model (285 MB) usually runs out of memory in Safari on iPhone and iPad: warn before separating. */
export const heavyOnThisDevice = (mode: StemMode): boolean => isIOS() && MODE_INFO[mode].models.includes('demucs6s');

export const MODE_INFO: Record<StemMode, { label: string; description: string; models: ModelId[]; downloadBytes: number; effort: string }> = (() => {
  const bytes = (ids: ModelId[]) => ids.reduce((sum, id) => sum + MODELS[id].bytes, 0);
  const kara2: ModelId[] = ['kara2Core', 'kara2Data'];
  const demucs: ModelId[] = ['demucs6s'];
  return {
    vocals: { label: 'Voz e instrumental', description: 'Voz principal, vocais de apoio e instrumental. Para karaokê e para ensaiar o canto.', models: kara2, downloadBytes: bytes(kara2), effort: 'alguns minutos' },
    four: { label: '4 faixas', description: 'Voz, bateria, baixo e outros. Para tocar junto tirando o seu instrumento.', models: demucs, downloadBytes: bytes(demucs), effort: 'vários minutos' },
    six: { label: '6 faixas', description: 'Voz, bateria, baixo, violão/guitarra, piano e outros. Para estudar cada instrumento.', models: demucs, downloadBytes: bytes(demucs), effort: 'vários minutos' },
    full: { label: 'Completa', description: 'As 6 faixas com a voz dividida em principal e apoio (7 faixas). O máximo de controle.', models: [...demucs, ...kara2], downloadBytes: bytes([...demucs, ...kara2]), effort: 'o dobro do tempo' },
  };
})();

// The study player uses six tracks. Vocal-specific modes remain available to the vocal division features.
export const availableModes = (): StemMode[] => ['six'];

export const decodeForSeparation = async (blob: Blob): Promise<{ planar: Float32Array; samples: number }> => {
  const context = new OfflineAudioContext(2, 1, SEPARATION_GEOMETRY.sampleRate);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  return toStereoPlanar(Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c)));
};

export const runSeparationInWorker = (planar: Float32Array, samples: number, mode: StemMode, onProgress: (p: SeparationProgress) => void, signal?: AbortSignal): Promise<SeparationTracks> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/separation.worker.ts', import.meta.url), { type: 'module' });
    const stop = () => {
      worker.terminate();
      reject(new DOMException('Separação cancelada.', 'AbortError'));
    };
    signal?.addEventListener('abort', stop, { once: true });
    worker.onmessage = (event: MessageEvent<SeparationResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') return onProgress(msg);
      signal?.removeEventListener('abort', stop);
      worker.terminate();
      if (msg.type === 'result') resolve(msg.tracks);
      else reject(new Error(msg.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'A separação falhou.'));
    };
    worker.postMessage({ type: 'separate', planar, samples, mode }, [planar.buffer]);
  });

/**
 * Runs one step of the separation. A storage refusal is explained in Portuguese and keeps the step and the
 * browser's own text, so a report from the field says exactly what failed; other errors pass through.
 */
const step = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    const raw = error instanceof Error ? (error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message) : String(error);
    throw new Error(`${explainQuota(await storageStatus())} Etapa: ${label}. Detalhe técnico: ${raw}`);
  }
};

type GpuLike = { requestAdapter?: () => Promise<unknown> };

/** A GPU object is not enough: blocklisted GPUs return no adapter. */
export const hasUsableWebGpu = async (gpu: GpuLike | undefined): Promise<boolean> => {
  try {
    return !!(await gpu?.requestAdapter?.());
  } catch {
    return false;
  }
};

type Deps = {
  persist?: boolean;
  mode?: StemMode;
  storage?: StorageApi;
  cachedModels?: () => Promise<{ id: ModelId }[]>;
  gpu?: GpuLike;
  signal?: AbortSignal;
  decode?: (blob: Blob) => Promise<{ planar: Float32Array; samples: number }>;
  run?: (planar: Float32Array, samples: number, mode: StemMode, onProgress: (p: SeparationProgress) => void, signal?: AbortSignal) => Promise<SeparationTracks>;
};

/** Separates and stores MP3 tracks; a quota refusal returns the completed tracks for session-only playback. */
export const separateSong = async (songId: string, onProgress: (p: SeparationProgress) => void, deps: Deps = {}): Promise<{ record: StemsRecord; persisted: boolean }> => {
  if (isMobileStudio()) throw new Error(MOBILE_TRACKS_NOTICE);
  const mode = deps.mode ?? 'six';
  const gpu = 'gpu' in deps ? deps.gpu : (navigator as Navigator & { gpu?: GpuLike }).gpu;
  if (!(await hasUsableWebGpu(gpu))) throw new Error(NO_WEBGPU);
  const audio = await db.audio.get(songId);
  if (!audio) throw new Error('Esta música não tem áudio para separar.');
  // Room for the models not on the device yet plus the new tracks (MP3 at 192 kbps), with a margin.
  const cached = new Set((await (deps.cachedModels ?? listCachedModels)().catch(() => [])).map((m) => m.id));
  const modelBytes = MODE_INFO[mode].models.filter((m) => !cached.has(m)).reduce((n, m) => n + MODELS[m].bytes, 0);
  const song = await db.songs.get(songId);
  const trackBytes = (song?.durationSec || 300) * 24000 * STEM_MODES[mode].tracks.length;
  void requestPersistence();
  await ensureRoom((modelBytes + (deps.persist === false ? 0 : trackBytes)) * 1.1, deps.storage);
  const { planar, samples } = await step('preparar o áudio', () => (deps.decode ?? decodeForSeparation)(audio.blob));
  const tracks = await step('separar as faixas', () => (deps.run ?? runSeparationInWorker)(planar, samples, mode, onProgress, deps.signal));
  deps.signal?.throwIfAborted();
  const names = STEM_MODES[mode].tracks;
  if (names.some((n) => !tracks[n])) throw new Error('A separação veio incompleta. Tente de novo.');
  const stamp = now();
  const record: StemsRecord = {
    songId,
    mode,
    model: MODE_INFO[mode].models.filter((m) => m !== 'kara2Data').map((m) => modelVersion(m)).join('+'),
    sampleRate: SEPARATION_GEOMETRY.sampleRate,
    tracks: names.map((name) => ({ name: name as StemName, blob: new Blob([tracks[name]!], { type: 'audio/mpeg' }) })),
    createdAt: stamp,
    selectedAt: `${stamp}${await laterThanOthers(songId, stamp)}`,
  };
  const outputBytes = record.tracks.reduce((sum, track) => sum + track.blob.size, 0);
  if (deps.persist === false) return { record, persisted: false };
  try {
    await ensureRoom(outputBytes * 1.1, deps.storage);
  } catch {
    // The estimate may change during processing. Keep the result without attempting a write.
    return { record, persisted: false };
  }
  deps.signal?.throwIfAborted();
  try {
    await step(`guardar ${record.tracks.length} faixas (${formatBytes(outputBytes)})`, () => db.stemSets.put(record));
  } catch (error) {
    // Preserve the storage error and the actual write size for diagnosing browser-specific failures.
    console.warn('Falha ao guardar as faixas separadas no IndexedDB', {
      songId,
      mode,
      totalBytes: outputBytes,
      tracks: record.tracks.map((track) => ({ name: track.name, bytes: track.blob.size })),
      error,
    });
    // A refused write must not discard tracks that were already generated successfully.
    if (isQuotaError(error)) return { record, persisted: false };
    throw error;
  }
  return { record, persisted: true };
};

export const listStemSets = (songId: string): Promise<StemsRecord[]> => db.stemSets.where('songId').equals(songId).toArray();

/** The separation that plays: the one chosen (or made) last. */
export const getStems = async (songId: string): Promise<StemsRecord | undefined> =>
  (await listStemSets(songId)).sort((a, z) => z.selectedAt.localeCompare(a.selectedAt))[0];

/** Suffix that keeps a new selection strictly after every other one, even within the same millisecond. */
const laterThanOthers = async (songId: string, stamp: string): Promise<string> => {
  const latest = (await getStems(songId))?.selectedAt ?? '';
  return stamp > latest ? '' : `${latest.slice(stamp.length)}~`;
};

export const selectStemSet = async (songId: string, mode: StemMode): Promise<void> => {
  const stamp = now();
  await db.stemSets.update([songId, mode], { selectedAt: `${stamp}${await laterThanOthers(songId, stamp)}` });
};

export const deleteStemSet = (songId: string, mode: StemMode): Promise<void> => db.stemSets.delete([songId, mode]);
export const deleteStems = (songId: string): Promise<number> => db.stemSets.where('songId').equals(songId).delete();

/** Vocal tracks for transcription: lead and backing, or the whole voice when the mode does not split it. */
export const findVoiceTracks = (record: StemsRecord | undefined) => record?.tracks.filter((t) => t.name === 'lead' || t.name === 'backing' || t.name === 'vocals') ?? [];
