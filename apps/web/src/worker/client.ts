import type { ChordSegment, KeyResult } from '@will-music/engine';
import type { AnalysisStage, WorkerRequest, WorkerResponse } from './protocol.ts';

export type AnalysisProgressEvent = { stage: AnalysisStage; done: number; total: number; detail?: string };

export const analyzeInWorker = (
  channels: Float32Array[],
  onProgress: (event: AnalysisProgressEvent) => void,
  signal?: AbortSignal,
): Promise<{ key: KeyResult; chords: ChordSegment[]; models: Record<string, string> }> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { signal?.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(signal?.reason ?? new DOMException('Análise cancelada.', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') onProgress(msg);
      else {
        cleanup();
        if (msg.type === 'result') resolve(msg);
        else reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'A análise falhou.'));
    };
    const request: WorkerRequest = { type: 'analyze', channels };
    try { worker.postMessage(request, channels.map((c) => c.buffer)); }
    catch (error) { cleanup(); reject(error); }
  });
