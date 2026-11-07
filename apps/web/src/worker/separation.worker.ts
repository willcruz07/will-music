/// <reference lib="webworker" />
import { MODELS, SEPARATION_GEOMETRY as G, applyMasks, createStemAccumulator, deriveStems, istftChunk, planChunks, sliceChunk, stftChunk } from '@will-music/engine';
import * as ort from 'onnxruntime-web/webgpu';
import { fetchModel } from '../lib/models.ts';
import type { SeparationRequest, SeparationResponse } from './separationProtocol.ts';

ort.env.logLevel = 'error';
const post = (message: SeparationResponse, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(message, transfer);

self.onmessage = async (event: MessageEvent<SeparationRequest>) => {
  if (event.data.type !== 'separate') return;
  const { planar, samples } = event.data;
  try {
    const total = MODELS.kara2Core.bytes + MODELS.kara2Data.bytes;
    const core = await fetchModel('kara2Core', (loaded) => post({ type: 'progress', stage: 'models', done: loaded, total }));
    const data = await fetchModel('kara2Data', (loaded) => post({ type: 'progress', stage: 'models', done: MODELS.kara2Core.bytes + loaded, total }));
    const session = await ort.InferenceSession.create(core, {
      executionProviders: ['webgpu'],
      externalData: [{ path: MODELS.kara2Data.file, data }],
    });
    try {
      const plan = planChunks(samples);
      const vocalsAcc = createStemAccumulator(samples, 2);
      for (let i = 0; i < plan.length; i++) {
        const chunk = sliceChunk(planar, samples, plan[i]!.start, G.chunkSamples);
        const stft = stftChunk(chunk);
        const out = await session.run({ stft_repr: new ort.Tensor('float32', stft, [1, 2050, G.frames, 2]) });
        const masks = out.masks?.data;
        if (!(masks instanceof Float32Array)) throw new Error('O modelo de separação não devolveu as máscaras.');
        // Mask 1 = vocals over the mix; mask 2 = backing over the vocals (chained).
        vocalsAcc.add(i, plan, [istftChunk(applyMasks(stft, masks, 1)), istftChunk(applyMasks(stft, masks, 2))]);
        post({ type: 'progress', stage: 'separate', done: i + 1, total: plan.length });
      }
      const [vocals, backing] = vocalsAcc.finish();
      const { instrumental, lead } = deriveStems(planar, vocals!, backing!);
      post({ type: 'result', instrumental, lead, backing: backing! }, [instrumental.buffer, lead.buffer, backing!.buffer]);
    } finally {
      await session.release();
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
