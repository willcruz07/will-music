/// <reference lib="webworker" />
import {
  DEMUCS,
  MODELS,
  SEPARATION_GEOMETRY as G,
  type StemMode,
  applyMasks,
  createStemAccumulator,
  createStreamingAccumulator,
  demucsTrackNames,
  demucsTracks,
  deriveStems,
  istftChunk,
  limitPeak,
  planChunks,
  sliceChunk,
  stftChunk,
} from '@will-music/engine';
import * as ort from 'onnxruntime-web/webgpu';
import { createMp3Encoder } from 'wasm-media-encoders';
import { fetchModel } from '../lib/models.ts';
import type { SeparationRequest, SeparationResponse, SeparationTracks } from './separationProtocol.ts';

ort.env.logLevel = 'error';
const post = (message: SeparationResponse, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);

// The kara2 graph needs 9 storage buffers per shader stage (WebGPU's default is 8): ask the adapter for its
// real limits, as Musetric does (packages/ai/src/runtime/webgpuDevice.ts, MIT).
const REQUIRED_STORAGE_BUFFERS = 9;
const LIMITS = [
  'maxBufferSize',
  'maxComputeInvocationsPerWorkgroup',
  'maxComputeWorkgroupSizeX',
  'maxComputeWorkgroupSizeY',
  'maxComputeWorkgroupSizeZ',
  'maxComputeWorkgroupStorageSize',
  'maxComputeWorkgroupsPerDimension',
  'maxStorageBufferBindingSize',
  'maxStorageBuffersPerShaderStage',
  'maxUniformBufferBindingSize',
] as const;
const FEATURES: GPUFeatureName[] = ['float32-blendable', 'float32-filterable', 'shader-f16', 'subgroups', 'timestamp-query'];

const createDevice = async (needsKara2: boolean): Promise<GPUDevice> => {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('A separação de faixas precisa de um navegador com WebGPU (Chrome ou Edge atualizados).');
  if (needsKara2 && adapter.limits.maxStorageBuffersPerShaderStage < REQUIRED_STORAGE_BUFFERS) {
    throw new Error('A placa de vídeo deste aparelho não suporta a separação de voz. Tente a separação em 4 ou 6 faixas.');
  }
  const requiredLimits: Record<string, number> = {};
  for (const limit of LIMITS) requiredLimits[limit] = adapter.limits[limit];
  return adapter.requestDevice({ requiredFeatures: FEATURES.filter((f) => adapter.features.has(f)), requiredLimits });
};

// Musetric normalizes the mix to a 0.9 peak before kara2 (the model card validates at that level).
const normalizePeak = (planar: Float32Array, max = 0.9): void => {
  let peak = 0;
  for (const v of planar) peak = Math.max(peak, Math.abs(v));
  if (peak <= max) return;
  const scale = max / peak;
  for (let i = 0; i < planar.length; i++) planar[i] = planar[i]! * scale;
};

/** Incremental MP3 (192 kbps CBR, stereo): planar regions go in, the file comes out at the end. */
const mp3Stream = async (sampleRate: number) => {
  const encoder = await createMp3Encoder();
  encoder.configure({ sampleRate, channels: 2, bitrate: 192 });
  const parts: Uint8Array[] = [];
  const STEP = sampleRate; // one second at a time keeps the encoder's own buffer small
  return {
    push(planar: Float32Array, length: number) {
      for (let i = 0; i < length; i += STEP) {
        const end = Math.min(length, i + STEP);
        parts.push(encoder.encode([planar.subarray(i, end), planar.subarray(length + i, length + end)]).slice());
      }
    },
    finish(): ArrayBuffer {
      parts.push(encoder.finalize().slice());
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let at = 0;
      for (const p of parts) {
        out.set(p, at);
        at += p.length;
      }
      return out.buffer;
    },
  };
};

const webgpu = (device: GPUDevice) => [{ name: 'webgpu', device, storageBufferCacheMode: 'simple' } as ort.InferenceSession.WebGpuExecutionProviderOption];

self.onmessage = async (event: MessageEvent<SeparationRequest>) => {
  if (event.data.type !== 'separate') return;
  const { planar, samples, mode } = event.data;
  const needsDemucs = mode !== 'vocals';
  const needsKara2 = mode === 'vocals' || mode === 'full';
  try {
    const device = await createDevice(needsKara2);
    const ids = [...(needsDemucs ? (['demucs6s'] as const) : []), ...(needsKara2 ? (['kara2Core', 'kara2Data'] as const) : [])];
    const totalBytes = ids.reduce((n, id) => n + MODELS[id].bytes, 0);
    let base = 0;
    const load = async (id: (typeof ids)[number]) => {
      const bytes = await fetchModel(id, (loaded) => post({ type: 'progress', stage: 'models', done: base + loaded, total: totalBytes }));
      base += MODELS[id].bytes;
      return bytes;
    };
    const demucsPlan = needsDemucs ? planChunks(samples, DEMUCS.SEGMENT, DEMUCS.OVERLAP) : [];
    const karaPlan = needsKara2 ? planChunks(samples) : [];
    const totalChunks = demucsPlan.length + karaPlan.length;
    let doneChunks = 0;
    const tick = () => post({ type: 'progress', stage: 'separate', done: ++doneChunks, total: totalChunks });
    const tracks: SeparationTracks = {};
    // Every model is downloaded and verified before any work starts (so a failed download never throws away
    // minutes of separation), but each one is read back from the cache only when its turn comes, so the
    // "full" mode never holds both models (~525 MB) at once.
    for (const id of ids) await load(id);

    try {
      // Demucs first: it reads the mix without changing it (kara2 turns the mix buffer into the instrumental).
      if (needsDemucs) {
        const demucsMode = mode as Exclude<StemMode, 'vocals'>;
        // Already optimized offline; re-optimizing it in the browser only spikes memory.
        let model: Uint8Array | null = await fetchModel('demucs6s');
        const session = await ort.InferenceSession.create(model, { executionProviders: webgpu(device), graphOptimizationLevel: 'disabled' });
        model = null;
        try {
          const names = demucsTrackNames(demucsMode);
          const encoders = await Promise.all(names.map(() => mp3Stream(DEMUCS.SAMPLE_RATE)));
          const acc = createStreamingAccumulator(demucsPlan, samples, names.length);
          for (let i = 0; i < demucsPlan.length; i++) {
            const out = await session.run({ [DEMUCS.INPUT]: new ort.Tensor('float32', sliceChunk(planar, samples, demucsPlan[i]!.start, DEMUCS.SEGMENT), [1, 2, DEMUCS.SEGMENT]) });
            const stems = out[DEMUCS.OUTPUT]?.data;
            if (!(stems instanceof Float32Array)) throw new Error('O modelo de separação não devolveu as faixas.');
            const region = acc.add(i, demucsTracks(demucsMode, stems, DEMUCS.SEGMENT));
            out[DEMUCS.OUTPUT]?.dispose?.();
            region.stems.forEach((s, k) => {
              // Streaming leaves no room for a whole-song limiter: clamp so LAME never wraps around.
              for (let j = 0; j < s.length; j++) s[j] = Math.max(-0.999, Math.min(0.999, s[j]!));
              encoders[k]!.push(s, region.to - region.from);
            });
            tick();
          }
          names.forEach((name, k) => (tracks[name] = encoders[k]!.finish()));
        } finally {
          await session.release();
        }
      }

      if (needsKara2) {
        let core: Uint8Array | null = await fetchModel('kara2Core');
        let data: Uint8Array | null = await fetchModel('kara2Data');
        const session = await ort.InferenceSession.create(core, { executionProviders: webgpu(device), externalData: [{ path: MODELS.kara2Data.file, data }] });
        // The runtime keeps its own copy: release ours (~240 MB) before the chunk loop.
        core = null;
        data = null;
        try {
          normalizePeak(planar);
          const acc = createStemAccumulator(samples, 2);
          for (let i = 0; i < karaPlan.length; i++) {
            const stft = stftChunk(sliceChunk(planar, samples, karaPlan[i]!.start, G.chunkSamples));
            const out = await session.run({ stft_repr: new ort.Tensor('float32', stft, [1, 2050, G.frames, 2]) });
            const masks = out.masks?.data;
            if (!(masks instanceof Float32Array)) throw new Error('O modelo de separação não devolveu as máscaras.');
            // Mask 1 = vocals over the mix; mask 2 = backing over the vocals (chained).
            acc.add(i, karaPlan, [istftChunk(applyMasks(stft, masks, 1)), istftChunk(applyMasks(stft, masks, 2))]);
            out.masks?.dispose?.();
            tick();
          }
          const [vocals, backing] = acc.finish();
          const stems = deriveStems(planar, vocals!, backing!);
          limitPeak([stems.instrumental, stems.lead, stems.backing], 0.99);
          const wanted = mode === 'full' ? (['lead', 'backing'] as const) : (['instrumental', 'lead', 'backing'] as const);
          for (const name of wanted) {
            const enc = await mp3Stream(G.sampleRate);
            enc.push(stems[name], samples);
            tracks[name] = enc.finish();
          }
        } finally {
          await session.release();
        }
      }
      post({ type: 'result', tracks }, Object.values(tracks));
    } finally {
      device.destroy();
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
