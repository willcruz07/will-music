/// <reference lib="webworker" />
import { analyzeKey, downmixMean, estimateKeyFromChords, type KeyResult, type ModelId, MODELS, modelVersion } from '@will-music/engine';
import { createLvAnalyzer } from '../lib/lvInference.ts';
import { analyzeLvSong } from '../lib/lvSong.ts';
import { CHORD_MODELS } from '../lib/models.ts';
import { fetchModel } from '../lib/models.ts';
import { createWebRunner } from '../lib/webRunner.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

const post = (message: WorkerResponse) => (self as DedicatedWorkerGlobalScope).postMessage(message);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'analyze') return;
  try {
    const pcm = event.data.channels.length === 1 ? event.data.channels[0]! : downmixMean(event.data.channels);
    const total = CHORD_MODELS.reduce((sum, id) => sum + MODELS[id].bytes, 0);
    let base = 0;
    // Keep a session copy: if the browser refuses caching, subsequent blocks must not download again.
    const assets = new Map<ModelId, Uint8Array<ArrayBuffer>>();
    const load = async (id: ModelId) => {
      const bytes = await fetchModel(id, (loaded) => post({ type: 'progress', stage: 'models', done: base + loaded, total }));
      base += MODELS[id].bytes;
      return bytes;
    };
    for (const id of CHORD_MODELS) assets.set(id, await load(id));
    const analyze = await createLvAnalyzer(async (id) => assets.get(id)!);
    const chords = await analyzeLvSong(pcm, (clip, detail) => analyze(clip, detail), (done, runs, detail) => post({ type: 'progress', stage: 'chords', done, total: runs, detail }));
    const keyRunner = await createWebRunner(assets.get('skey')!);
    try {
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
      post({ type: 'result', key, chords, models: { chords: modelVersion('lv0'), chordEnsemble: CHORD_MODELS.filter((id) => /^lv[0-4]$/.test(id)).map(modelVersion).join('+'), cqtPlan: modelVersion('lvPlans'), key: keyModel, chordDecoder: 'lv-polyphase-context-30s-v1' } });
    } finally {
      await keyRunner.release();
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
