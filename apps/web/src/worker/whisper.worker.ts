/// <reference lib="webworker" />
import { pipeline } from '@huggingface/transformers';
import type { WhisperChunk } from '../lib/transcript.ts';
import { whisperModelFor } from '../lib/whisperModel.ts';

/** `preload` only downloads and caches the model (first-run setup); `transcribe` runs it on audio. */
export type WhisperRequest = { type: 'transcribe'; audio: Float32Array } | { type: 'preload' };
export type WhisperResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'result'; chunks: WhisperChunk[]; device: 'webgpu' | 'wasm'; words: boolean }
  | { type: 'ready' }
  | { type: 'error'; message: string };

const post = (m: WhisperResponse) => (self as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (event: MessageEvent<WhisperRequest>) => {
  const request = event.data;
  try {
    // A GPU object is not enough (blocklisted GPUs return no adapter); fall back to wasm on any WebGPU failure.
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    let device: 'webgpu' | 'wasm' = (await gpu?.requestAdapter().catch(() => null)) ? 'webgpu' : 'wasm';
    const files = new Map<string, { loaded: number; total: number }>();
    // The model follows the device: small on the GPU, the lighter base on the processor (see whisperModel.ts).
    const load = (dev: 'webgpu' | 'wasm') => pipeline('automatic-speech-recognition', whisperModelFor(dev), {
      device: dev,
      dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' },
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file) return;
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        post({ type: 'progress', loaded, total });
      },
    });
    let asr;
    try {
      asr = await load(device);
    } catch (error) {
      if (device !== 'webgpu') throw error;
      device = 'wasm';
      asr = await load(device);
    }
    if (request.type === 'preload') return post({ type: 'ready' });
    const run = (timestamps: true | 'word') =>
      asr(request.audio, { language: 'portuguese', task: 'transcribe', return_timestamps: timestamps, chunk_length_s: 30, stride_length_s: 5 }) as Promise<{ chunks?: WhisperChunk[] }>;
    // Word timestamps put each line where its first word is sung; segment timestamps are the fallback.
    let words = true;
    let output: { chunks?: WhisperChunk[] };
    try {
      output = await run('word');
    } catch {
      words = false;
      output = await run(true);
    }
    post({ type: 'result', chunks: output.chunks ?? [], device, words });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
