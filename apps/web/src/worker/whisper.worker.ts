/// <reference lib="webworker" />
import { env, WhisperTextStreamer, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { whisperResourceCache } from '../lib/whisperCache.ts';
import { type WhisperChunk, windowCount } from '../lib/transcript.ts';
import { whisperModelFor } from '../lib/whisperModel.ts';
import { isWordTimestampFailure } from '../lib/analysisExecution.ts';

/**
 * `preload` only downloads and caches the model (first-run setup); `warm` loads it and keeps it in this worker
 * so a later `transcribe` starts at once (the studio warms it while the tracks are separated); `transcribe` runs it.
 */
export type WhisperRequest = { type: 'transcribe'; audio: Float32Array } | { type: 'preload' } | { type: 'warm' };
export type WhisperResponse =
  | { type: 'progress'; loaded: number; total: number }
  /** While transcribing: 30 s windows done of the total, and the latest words heard (shows it is not stuck). */
  | { type: 'transcribing'; done: number; total: number; heard: string }
  | { type: 'result'; chunks: WhisperChunk[]; device: 'webgpu' | 'wasm'; words: boolean }
  | { type: 'ready'; device: 'webgpu' | 'wasm' }
  /** The model of a `warm` request is loaded (or could not be: `transcribe` then tries again on its own). */
  | { type: 'warmed'; ok: boolean }
  | { type: 'error'; message: string };

const post = (m: WhisperResponse) => (self as DedicatedWorkerGlobalScope).postMessage(m);
env.useCustomCache = true;
env.customCache = whisperResourceCache;

type Loaded = { asr: AutomaticSpeechRecognitionPipeline; device: 'webgpu' | 'wasm' };

const loadPipeline = async (): Promise<Loaded> => {
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
  try {
    return { asr: await load(device), device };
  } catch (error) {
    if (device !== 'webgpu') throw error;
    device = 'wasm';
    return { asr: await load(device), device };
  }
};

let warm: Promise<Loaded | undefined> | undefined;

self.onmessage = async (event: MessageEvent<WhisperRequest>) => {
  const request = event.data;
  if (request.type === 'warm') {
    warm ??= loadPipeline().then(
      (loaded) => { post({ type: 'warmed', ok: true }); return loaded; },
      () => { post({ type: 'warmed', ok: false }); return undefined; },
    );
    return;
  }
  let asr: AutomaticSpeechRecognitionPipeline | undefined;
  try {
    const loaded = (warm ? await warm : undefined) ?? await loadPipeline();
    warm = undefined;
    asr = loaded.asr;
    const device = loaded.device;
    if (request.type === 'preload') {
      await asr.dispose().catch(() => {});
      asr = undefined;
      return post({ type: 'ready', device });
    }
    const total = windowCount(request.audio.length, 16000);
    const recognizer = asr;
    const run = (timestamps: true | 'word') => {
      let done = 0;
      let heard = '';
      let last = 0;
      const report = (force = false) => {
        const now = Date.now();
        if (!force && now - last < 400) return;
        last = now;
        post({ type: 'transcribing', done: Math.min(done, total), total, heard: heard.trim() });
      };
      report(true);
      // One generate() per 30 s window: its end marks a window done; the words keep coming in between.
      const streamer = new WhisperTextStreamer(recognizer.tokenizer as ConstructorParameters<typeof WhisperTextStreamer>[0], {
        skip_prompt: true,
        callback_function: (text: string) => {
          heard = `${heard}${text}`.slice(-80);
          report();
        },
        on_finalize: () => {
          done++;
          report(true);
        },
      });
      return recognizer(request.audio, { language: 'portuguese', task: 'transcribe', return_timestamps: timestamps, chunk_length_s: 30, stride_length_s: 5, streamer }) as Promise<{ chunks?: WhisperChunk[] }>;
    };
    // Word timestamps put each line where its first word is sung; segment timestamps are the fallback.
    let words = true;
    let output: { chunks?: WhisperChunk[] };
    try {
      output = await run('word');
    } catch (error) {
      if (!isWordTimestampFailure(error)) throw error;
      words = false;
      output = await run(true);
    }
    await asr.dispose().catch(() => {});
    asr = undefined;
    post({ type: 'result', chunks: output.chunks ?? [], device, words });
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally {
    if (asr) await asr.dispose().catch(() => {});
  }
};
