/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm';
import { computeLvFeatures, decodeLvChords, estimateLvTuning, type ChordSegment, type LvPlan, type LvCandidate } from '@will-music/engine';

export type LvResponse = { type: 'progress'; label: string } | { type: 'result'; chords: ChordSegment[]; seconds: number } | { type: 'error'; message: string };
const heads = ['triad', 'bass', 'seventh', 'ninth', 'eleventh', 'thirteenth'] as const;
const widths = [73, 13, 4, 4, 3, 3];
const post = (message: LvResponse) => (self as DedicatedWorkerGlobalScope).postMessage(message);
ort.env.wasm.numThreads = 1;

type Asset = { file: string; sha256: string; bytes: number };
type Manifest = { version: string; models: Asset[]; plans: Asset[]; dictionary: Asset };
const verified = async (asset: Asset, model = false): Promise<ArrayBuffer> => {
  const route = model ? `/__lv/models/${asset.file.match(/chordnet-(\d)\.onnx$/)?.[1]}.onnx` : `/__lv/assets/${asset.file}`;
  const cache = typeof caches !== 'undefined' ? await caches.open('wm-lv-browser-v1').catch(() => null) : null;
  let response = await cache?.match(route);
  let bytes = response ? await response.arrayBuffer() : null;
  const valid = async (data: ArrayBuffer) => data.byteLength === asset.bytes && Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (value) => value.toString(16).padStart(2, '0')).join('') === asset.sha256;
  if (bytes && !(await valid(bytes))) { await cache?.delete(route); bytes = null; }
  if (!bytes) {
    response = await fetch(route);
    if (!response.ok) throw new Error('Os arquivos do LV-Chordia não estão preparados neste servidor.');
    bytes = await response.arrayBuffer();
    if (!(await valid(bytes))) throw new Error(`Arquivo experimental inválido: ${asset.file}`);
    // Cache refusal must not prevent a session-only analysis.
    await cache?.put(route, new Response(bytes)).catch(() => {});
  }
  return bytes;
};

self.onmessage = async (event: MessageEvent<{ pcm: Float32Array<ArrayBuffer> }>) => {
  const started = performance.now();
  try {
    if (!event.data.pcm.length || event.data.pcm.length > 22050 * 60) throw new Error('Escolha um trecho de até 60 segundos.');
    const response = await fetch('/__lv/assets/manifest.json');
    if (!response.ok) throw new Error('Os arquivos do LV-Chordia não estão preparados neste servidor.');
    const manifest = await response.json() as Manifest;
    post({ type: 'progress', label: 'Estimando afinação no navegador…' });
    const tuning = estimateLvTuning(event.data.pcm);
    const planIndex = Math.max(0, Math.min(99, Math.round((tuning + 0.5) * 100)));
    const plan = JSON.parse(new TextDecoder().decode(await verified(manifest.plans[planIndex]!))) as LvPlan;
    const { data: features, frames } = computeLvFeatures(event.data.pcm, plan, (done, total) => post({ type: 'progress', label: `Preparando CQT no navegador (${done}/${total})…` }));
    if (!Number.isInteger(frames) || frames < 1) throw new Error('O CQT local retornou dimensões inválidas.');
    const sums = widths.map((width) => new Float32Array(frames * width));
    const input = new ort.Tensor('float32', features, [1, frames, 252]);
    try {
      for (let member = 0; member < 5; member++) {
        post({ type: 'progress', label: `Executando rede ${member + 1} de 5 no navegador…` });
        const session = await ort.InferenceSession.create(await verified(manifest.models[member]!, true), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
        try {
          const outputs = await session.run({ features: input });
          try {
            heads.forEach((head, index) => {
              const values = outputs[head]?.data;
              const width = widths[index]!;
              if (!(values instanceof Float32Array) || values.length !== frames * width) throw new Error(`Saída inválida: ${head}`);
              const sum = sums[index]!;
              for (let frame = 0; frame < frames; frame++) {
                const offset = frame * width;
                let max = -Infinity;
                for (let col = 0; col < width; col++) max = Math.max(max, values[offset + col]!);
                let total = 0;
                for (let col = 0; col < width; col++) total += Math.exp(values[offset + col]! - max);
                for (let col = 0; col < width; col++) sum[offset + col] = sum[offset + col]! + Math.exp(values[offset + col]! - max) / total / 5;
              }
            });
          } finally {
            Object.values(outputs).forEach((tensor) => tensor.dispose());
          }
        } finally {
          await session.release();
        }
      }
    } finally {
      input.dispose();
    }
    post({ type: 'progress', label: 'Interpretando acordes no navegador…' });
    const dictionary = JSON.parse(new TextDecoder().decode(await verified(manifest.dictionary))) as LvCandidate[];
    const chords = decodeLvChords(sums, frames, dictionary);
    post({ type: 'result', chords, seconds: (performance.now() - started) / 1000 });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
