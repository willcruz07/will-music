/// <reference lib="webworker" />
import { MODELS, SEPARATION_GEOMETRY as G, applyMasks, createStemAccumulator, deriveStems, istftChunk, limitPeak, planChunks, sliceChunk, stftChunk } from '@will-music/engine';
import * as ort from 'onnxruntime-web/webgpu';
import { fetchModel } from '../lib/models.ts';
import { encodeWav16Buffer } from '../lib/wav.ts';
import type { SeparationRequest, SeparationResponse } from './separationProtocol.ts';

ort.env.logLevel = 'error';
const post = (message: SeparationResponse, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);

// This graph needs 9 storage buffers per shader stage (WebGPU's default is 8): ask the adapter for its
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

const createDevice = async (): Promise<GPUDevice> => {
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('A separação de faixas precisa de um navegador com WebGPU (Chrome ou Edge atualizados).');
  if (adapter.limits.maxStorageBuffersPerShaderStage < REQUIRED_STORAGE_BUFFERS) {
    throw new Error('A placa de vídeo deste aparelho não suporta a separação de faixas.');
  }
  const requiredLimits: Record<string, number> = {};
  for (const limit of LIMITS) requiredLimits[limit] = adapter.limits[limit];
  return adapter.requestDevice({ requiredFeatures: FEATURES.filter((f) => adapter.features.has(f)), requiredLimits });
};

// Musetric normalizes the mix to a 0.9 peak before inference (the model card validates at that level).
const normalizePeak = (planar: Float32Array, max = 0.9): void => {
  let peak = 0;
  for (const v of planar) peak = Math.max(peak, Math.abs(v));
  if (peak <= max) return;
  const scale = max / peak;
  for (let i = 0; i < planar.length; i++) planar[i] = planar[i]! * scale;
};

self.onmessage = async (event: MessageEvent<SeparationRequest>) => {
  if (event.data.type !== 'separate') return;
  const { planar, samples } = event.data;
  try {
    const device = await createDevice();
    const total = MODELS.kara2Core.bytes + MODELS.kara2Data.bytes;
    let core: Uint8Array | null = await fetchModel('kara2Core', (loaded) => post({ type: 'progress', stage: 'models', done: loaded, total }));
    let data: Uint8Array | null = await fetchModel('kara2Data', (loaded) => post({ type: 'progress', stage: 'models', done: MODELS.kara2Core.bytes + loaded, total }));
    const session = await ort.InferenceSession.create(core, {
      executionProviders: [{ name: 'webgpu', device, storageBufferCacheMode: 'simple' } as ort.InferenceSession.WebGpuExecutionProviderOption],
      externalData: [{ path: MODELS.kara2Data.file, data }],
    });
    // The runtime keeps its own copy: release ours (~240 MB) before the chunk loop.
    core = null;
    data = null;
    try {
      normalizePeak(planar);
      const plan = planChunks(samples);
      const acc = createStemAccumulator(samples, 2);
      for (let i = 0; i < plan.length; i++) {
        const stft = stftChunk(sliceChunk(planar, samples, plan[i]!.start, G.chunkSamples));
        const out = await session.run({ stft_repr: new ort.Tensor('float32', stft, [1, 2050, G.frames, 2]) });
        const masks = out.masks?.data;
        if (!(masks instanceof Float32Array)) throw new Error('O modelo de separação não devolveu as máscaras.');
        // Mask 1 = vocals over the mix; mask 2 = backing over the vocals (chained).
        acc.add(i, plan, [istftChunk(applyMasks(stft, masks, 1)), istftChunk(applyMasks(stft, masks, 2))]);
        out.masks?.dispose?.();
        post({ type: 'progress', stage: 'separate', done: i + 1, total: plan.length });
      }
      const [vocals, backing] = acc.finish();
      const stems = deriveStems(planar, vocals!, backing!);
      limitPeak([stems.instrumental, stems.lead, stems.backing], 0.99);
      const wav = {
        instrumental: encodeWav16Buffer(stems.instrumental, 2, G.sampleRate),
        lead: encodeWav16Buffer(stems.lead, 2, G.sampleRate),
        backing: encodeWav16Buffer(stems.backing, 2, G.sampleRate),
      };
      post({ type: 'result', ...wav }, [wav.instrumental, wav.lead, wav.backing]);
    } finally {
      await session.release();
      device.destroy();
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
