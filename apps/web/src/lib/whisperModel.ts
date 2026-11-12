import { WHISPER_BLOCK_CACHE, whisperResourceCache } from './whisperCache.ts';
/** Where Whisper runs: on the GPU (WebGPU) or on the processor (wasm). */
export type WhisperDevice = 'webgpu' | 'wasm';

/**
 * The Whisper model for a device: the small one (~300 MB, better with sung lyrics) where WebGPU runs it fast,
 * and the base one (~80 MB, several times faster) on the processor — most iPhones and iPads before iOS 26.
 * Transcribing the separated vocals (when there are) makes up for much of the difference.
 */
export const whisperModelFor = (device: WhisperDevice): string =>
  device === 'webgpu' ? 'onnx-community/whisper-small_timestamped' : 'onnx-community/whisper-base_timestamped';

/** Approximate download of each model, for the setup screen. */
export const WHISPER_BYTES: Record<WhisperDevice, number> = { webgpu: 300 * 1024 * 1024, wasm: 80 * 1024 * 1024 };

/** Config/tokenizer files alone do not make a model available offline. Both selected q4 networks are required. */
export const whisperCacheReady = async (device: WhisperDevice): Promise<boolean> => {
  if (typeof caches === 'undefined') return false;
  try {
    const name = whisperModelFor(device).split('/')[1]!;
    const legacy = await (await caches.open('transformers-cache')).keys();
    const blocks = await (await caches.open(WHISPER_BLOCK_CACHE)).keys();
    const entries = [...legacy, ...blocks];
    const required = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'preprocessor_config.json', 'onnx/encoder_model_q4.onnx', 'onnx/decoder_model_merged_q4.onnx'];
    for (const file of required) {
      const entry = entries.find(request => { const url = new URL(request.url); return !url.searchParams.has('__wm_block') && url.pathname.includes(`/${name}/resolve/`) && url.pathname.endsWith(`/${file}`); });
      if (!entry) return false;
      // Legacy entries are already complete responses; block manifests need validation.
      if (!legacy.some(request => request.url === entry.url) && !await whisperResourceCache.match(entry.url)) return false;
    }
    return true;
  } catch { return false; }
};

/** The device this browser will use (a GPU object is not enough: blocklisted GPUs return no adapter). */
export const detectWhisperDevice = async (): Promise<WhisperDevice> => {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  return (await gpu?.requestAdapter().catch(() => null)) ? 'webgpu' : 'wasm';
};
