import type { ChordSegment, KeyResult } from '@will-music/engine';
import type { AnalysisStage, WorkerRequest, WorkerResponse } from './protocol.ts';

export type AnalysisProgressEvent = { stage: AnalysisStage; done: number; total: number };

export const analyzeInWorker = (
  channels: Float32Array[],
  onProgress: (event: AnalysisProgressEvent) => void,
): Promise<{ key: KeyResult; chords: ChordSegment[]; models: Record<string, string> }> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') onProgress(msg);
      else {
        worker.terminate();
        if (msg.type === 'result') resolve(msg);
        else reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'A análise falhou.'));
    };
    const request: WorkerRequest = { type: 'analyze', channels };
    worker.postMessage(request, channels.map((c) => c.buffer));
  });
