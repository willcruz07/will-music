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

/** The device this browser will use (a GPU object is not enough: blocklisted GPUs return no adapter). */
export const detectWhisperDevice = async (): Promise<WhisperDevice> => {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  return (await gpu?.requestAdapter().catch(() => null)) ? 'webgpu' : 'wasm';
};
