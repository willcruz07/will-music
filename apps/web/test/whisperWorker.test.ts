import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@huggingface/transformers', () => ({ env: {}, pipeline: mocks.load, WhisperTextStreamer: class {} }));
beforeEach(() => { vi.resetModules(); mocks.load.mockReset(); vi.stubGlobal('navigator', { userAgent: 'test' }); });
afterEach(() => vi.unstubAllGlobals());

const runWorker = async (recognize: ReturnType<typeof vi.fn>) => {
  const dispose = vi.fn(async () => {});
  mocks.load.mockResolvedValue(Object.assign(recognize, { tokenizer: {}, dispose }));
  const messages: { type: string; words?: boolean; message?: string }[] = [];
  const context: { postMessage: (message: typeof messages[number]) => void; onmessage?: (event: unknown) => Promise<void> } = { postMessage: (message) => messages.push(message) };
  vi.stubGlobal('self', context);
  await import('../src/worker/whisper.worker.ts');
  await context.onmessage!({ data: { type: 'transcribe', audio: new Float32Array(16000) } });
  return { messages, dispose };
};
describe('Whisper inference retries', () => {
  it('retries with segment timestamps only for a word-alignment incompatibility', async () => {
    const recognize = vi.fn().mockRejectedValueOnce(new Error('Missing alignment_heads for word timestamps')).mockResolvedValueOnce({ chunks: [] });
    const { messages, dispose } = await runWorker(recognize);
    expect(recognize).toHaveBeenCalledTimes(2);
    expect(recognize.mock.calls[0]![1].return_timestamps).toBe('word');
    expect(recognize.mock.calls[1]![1].return_timestamps).toBe(true);
    expect(messages.at(-1)).toMatchObject({ type: 'result', words: false });
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it('does not transcribe the entire song twice after an inference resource failure', async () => {
    const recognize = vi.fn().mockRejectedValue(new Error('WASM out of memory'));
    const { messages, dispose } = await runWorker(recognize);
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(messages.at(-1)).toMatchObject({ type: 'error', message: 'WASM out of memory' });
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
