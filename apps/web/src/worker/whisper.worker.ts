/// <reference lib="webworker" />
import { pipeline } from '@huggingface/transformers';
import type { WhisperChunk } from '../lib/transcript.ts';

export type WhisperRequest = { type: 'transcribe'; audio: Float32Array };
export type WhisperResponse =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'result'; chunks: WhisperChunk[]; device: 'webgpu' | 'wasm' }
  | { type: 'error'; message: string };

const post = (m: WhisperResponse) => (self as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (event: MessageEvent<WhisperRequest>) => {
  if (event.data.type !== 'transcribe') return;
  try {
    const device = (navigator as Navigator & { gpu?: unknown }).gpu ? 'webgpu' : 'wasm';
    const files = new Map<string, { loaded: number; total: number }>();
    const asr = await pipeline('automatic-speech-recognition', 'onnx-community/whisper-small_timestamped', {
      device,
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
    const output = (await asr(event.data.audio, {
      language: 'portuguese',
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    })) as { chunks?: WhisperChunk[] };
    post({ type: 'result', chunks: output.chunks ?? [], device });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
