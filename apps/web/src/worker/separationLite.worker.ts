/// <reference lib="webworker" />
// Light 4-track separation for phones: SCNet Tran Small on the processor (onnxruntime-web WASM, one thread),
// 11 s chunks with overlap, STFT/iSTFT in JS, each finished stretch encoded to MP3 as it is produced so the
// whole song is never held as float tracks.
import { MODELS, SCNET, createStreamingAccumulator, planChunks, scnetSpectrum, scnetStems, scnetTracks, sliceChunk, SCNET_FRAMES } from '@will-music/engine';
import * as ort from 'onnxruntime-web/wasm';
import { createAlignedMp3 } from '../lib/mp3.ts';
import { ensureModel, fetchModel } from '../lib/models.ts';
import type { SeparationRequest, SeparationResponse, SeparationTracks } from './separationProtocol.ts';

ort.env.logLevel = 'error';
ort.env.wasm.numThreads = 1;
const post = (message: SeparationResponse, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);
const NAMES = ['vocals', 'drums', 'bass', 'other'] as const;

self.onmessage = async (event: MessageEvent<SeparationRequest>) => {
  if (event.data.type !== 'separate') return;
  const { planar, samples } = event.data;
  let stage = `baixar o modelo ${MODELS.scnetTran.file}`;
  try {
    const kept = await ensureModel('scnetTran', (loaded) => post({ type: 'progress', stage: 'models', done: loaded, total: MODELS.scnetTran.bytes }));
    stage = 'carregar o modelo de 4 faixas (modo leve)';
    let model: Uint8Array | null = kept ?? (await fetchModel('scnetTran'));
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    model = null;
    try {
      const plan = planChunks(samples, SCNET.SEGMENT, SCNET.OVERLAP);
      const encoders = await Promise.all(NAMES.map(() => createAlignedMp3(SCNET.SAMPLE_RATE, 192)));
      const acc = createStreamingAccumulator(plan, samples, NAMES.length);
      post({ type: 'progress', stage: 'separate', done: 0, total: plan.length });
      for (let i = 0; i < plan.length; i++) {
        stage = `separar em faixas (bloco ${i + 1} de ${plan.length})`;
        let spec: Float32Array | null = scnetSpectrum(sliceChunk(planar, samples, plan[i]!.start, SCNET.SEGMENT));
        const input = new ort.Tensor('float32', spec, [1, 4, 2049, SCNET_FRAMES]);
        spec = null;
        const out = await session.run({ [SCNET.INPUT]: input });
        input.dispose?.();
        const data = out[SCNET.OUTPUT]?.data;
        if (!(data instanceof Float32Array)) throw new Error('O modelo de separação não devolveu as faixas.');
        const tracks = scnetTracks(scnetStems(data));
        out[SCNET.OUTPUT]?.dispose?.();
        const region = acc.add(i, tracks);
        const length = region.to - region.from;
        region.stems.forEach((s, k) => {
          for (let j = 0; j < s.length; j++) s[j] = Math.max(-0.999, Math.min(0.999, s[j]!));
          encoders[k]!.push(s.subarray(0, length), s.subarray(length, 2 * length));
        });
        post({ type: 'progress', stage: 'separate', done: i + 1, total: plan.length });
      }
      const result: SeparationTracks = {};
      NAMES.forEach((name, k) => (result[name] = encoders[k]!.finish()));
      post({ type: 'result', tracks: result }, Object.values(result));
    } finally {
      await session.release();
    }
  } catch (error) {
    const text = error instanceof Error ? (error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message) : String(error);
    post({ type: 'error', message: `${stage}: ${text}` });
  }
};
