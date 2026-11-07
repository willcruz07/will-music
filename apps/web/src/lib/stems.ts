import { SEPARATION_GEOMETRY, modelVersion, toStereoPlanar } from '@will-music/engine';
import type { SeparationResponse, SeparationTracks } from '../worker/separationProtocol.ts';
import { type StemsRecord, db, now } from './db.ts';
import { encodeWav16 } from './wav.ts';

export const NO_WEBGPU = 'A separação de faixas precisa de um navegador com WebGPU (Chrome ou Edge atualizados).';

export type SeparationProgress = { stage: 'models' | 'separate'; done: number; total: number };

export const decodeForSeparation = async (blob: Blob): Promise<{ planar: Float32Array; samples: number }> => {
  const context = new OfflineAudioContext(2, 1, SEPARATION_GEOMETRY.sampleRate);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  return toStereoPlanar(Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).slice()));
};

export const runSeparationInWorker = (planar: Float32Array, samples: number, onProgress: (p: SeparationProgress) => void): Promise<SeparationTracks> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/separation.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<SeparationResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') return onProgress(msg);
      worker.terminate();
      if (msg.type === 'result') resolve(msg);
      else reject(new Error(msg.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'A separação falhou.'));
    };
    worker.postMessage({ type: 'separate', planar, samples }, [planar.buffer]);
  });

type Deps = {
  gpu?: unknown;
  decode?: (blob: Blob) => Promise<{ planar: Float32Array; samples: number }>;
  run?: (planar: Float32Array, samples: number, onProgress: (p: SeparationProgress) => void) => Promise<SeparationTracks>;
};

/** Separates a song into instrumental, lead and backing and stores them together; on failure nothing is written. */
export const separateSong = async (songId: string, onProgress: (p: SeparationProgress) => void, deps: Deps = {}): Promise<void> => {
  const gpu = 'gpu' in deps ? deps.gpu : (navigator as Navigator & { gpu?: unknown }).gpu;
  if (!gpu) throw new Error(NO_WEBGPU);
  const audio = await db.audio.get(songId);
  if (!audio) throw new Error('Esta música não tem áudio para separar.');
  const { planar, samples } = await (deps.decode ?? decodeForSeparation)(audio.blob);
  const tracks = await (deps.run ?? runSeparationInWorker)(planar, samples, onProgress);
  const rate = SEPARATION_GEOMETRY.sampleRate;
  const record: StemsRecord = {
    songId,
    model: modelVersion('kara2Core'),
    sampleRate: rate,
    tracks: [
      { name: 'instrumental', blob: encodeWav16(tracks.instrumental, 2, rate) },
      { name: 'lead', blob: encodeWav16(tracks.lead, 2, rate) },
      { name: 'backing', blob: encodeWav16(tracks.backing, 2, rate) },
    ],
    createdAt: now(),
  };
  await db.stems.put(record);
};

export const getStems = (songId: string): Promise<StemsRecord | undefined> => db.stems.get(songId);
export const deleteStems = (songId: string): Promise<void> => db.stems.delete(songId);
