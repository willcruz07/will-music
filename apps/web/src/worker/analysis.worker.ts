/// <reference lib="webworker" />
import { analyzeChords, analyzeKey, downmixMean, estimateKeyFromChords, type KeyResult, MODELS, modelVersion, verifyCqtPlan } from '@will-music/engine';
import { fetchModel } from '../lib/models.ts';
import { createWebRunner } from '../lib/webRunner.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

const post = (message: WorkerResponse) => (self as DedicatedWorkerGlobalScope).postMessage(message);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'analyze') return;
  try {
    const pcm = downmixMean(event.data.channels);
    const total = MODELS.chordnet.bytes + MODELS.cqtPlan.bytes + MODELS.skey.bytes;
    let base = 0;
    const load = async (id: 'chordnet' | 'cqtPlan' | 'skey') => {
      const bytes = await fetchModel(id, (loaded) => post({ type: 'progress', stage: 'models', done: base + loaded, total }));
      base += MODELS[id].bytes;
      return bytes;
    };
    const plan = await verifyCqtPlan(await load('cqtPlan'));
    const chordRunner = await createWebRunner(await load('chordnet'));
    const keyRunner = await createWebRunner(await load('skey'));
    try {
      const chords = await analyzeChords(pcm, plan, chordRunner, (done, runs) => post({ type: 'progress', stage: 'chords', done, total: runs }));
      post({ type: 'progress', stage: 'key', done: 0, total: 1 });
      // A key-model failure (e.g. a very short clip) must not throw away the chords already detected.
      let key: KeyResult;
      let keyModel = modelVersion('skey');
      try {
        key = await analyzeKey(pcm, keyRunner);
      } catch {
        key = estimateKeyFromChords(chords);
        keyModel = 'estimado-pelos-acordes';
      }
      post({ type: 'result', key, chords, models: { chords: modelVersion('chordnet'), cqtPlan: modelVersion('cqtPlan'), key: keyModel, chordDecoder: 'adaptive-3-frame-v1' } });
    } finally {
      await chordRunner.release();
      await keyRunner.release();
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
