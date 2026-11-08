import { afterEach, describe, expect, it, vi } from 'vitest';
import { whisperCached, whisperModelFor } from '../src/lib/whisper.ts';

afterEach(() => vi.unstubAllGlobals());

describe('Whisper model by device', () => {
  it('uses the small model with WebGPU and the lighter base model on the CPU (most iPhones and iPads)', () => {
    expect(whisperModelFor('webgpu')).toBe('onnx-community/whisper-small_timestamped');
    expect(whisperModelFor('wasm')).toBe('onnx-community/whisper-base_timestamped');
  });

  it('checks the cache for the model this device will use', async () => {
    vi.stubGlobal('caches', { open: async () => ({ keys: async () => [new Request('https://huggingface.co/onnx-community/whisper-base_timestamped/resolve/main/onnx/encoder_model_q4.onnx')] }) });
    expect(await whisperCached('wasm')).toBe(true);
    expect(await whisperCached('webgpu')).toBe(false);
  });
});
