import { afterEach, describe, expect, it, vi } from 'vitest';
import { whisperCached, whisperModelFor } from '../src/lib/whisper.ts';

afterEach(() => vi.unstubAllGlobals());

describe('Whisper model by device', () => {
  it('uses the small model with WebGPU and the lighter base model on the CPU (most iPhones and iPads)', () => {
    expect(whisperModelFor('webgpu')).toBe('onnx-community/whisper-small_timestamped');
    expect(whisperModelFor('wasm')).toBe('onnx-community/whisper-base_timestamped');
  });

  it('requires both networks and metadata instead of treating a partial cache as installed', async () => {
    const files = ['onnx/encoder_model_q4.onnx'];
    vi.stubGlobal('caches', { open: async () => ({ keys: async () => files.map((file) => new Request(`https://huggingface.co/onnx-community/whisper-base_timestamped/resolve/main/${file}`)) }) });
    expect(await whisperCached('wasm')).toBe(false);
    files.push('onnx/decoder_model_merged_q4.onnx', 'config.json', 'tokenizer.json', 'tokenizer_config.json', 'preprocessor_config.json');
    expect(await whisperCached('wasm')).toBe(true);
    expect(await whisperCached('webgpu')).toBe(false);
  });
});
