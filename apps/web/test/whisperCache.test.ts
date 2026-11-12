import { afterEach, expect, it, vi } from 'vitest';
import { whisperResourceCache, WHISPER_BLOCK_CACHE } from '../src/lib/whisperCache.ts';
afterEach(() => vi.unstubAllGlobals());
const setup = (failBlock = false) => {
  const stores = new Map<string, Map<string, Response>>();
  vi.stubGlobal('caches', { open: async (name: string) => {
    const data = stores.get(name) ?? new Map<string, Response>(); stores.set(name, data);
    return {
      match: async (key: string) => data.get(key)?.clone(),
      put: async (key: string, response: Response) => {
        if (failBlock && data.size === 1) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        data.set(key, response.clone());
      },
      delete: async (key: string) => data.delete(key),
    };
  } });
  return stores;
};
it('stores bounded blocks and reconstructs the exact model response', async () => {
  const stores = setup(); const key = 'https://example.com/model.onnx';
  const data = new Uint8Array(5 * 1024 * 1024 + 7); data[0] = 17; data[data.length - 1] = 91;
  await whisperResourceCache.put(key, new Response(data));
  const result = await whisperResourceCache.match(key);
  const restored = new Uint8Array(await result!.arrayBuffer());
  expect(restored.length).toBe(data.length);
  expect(restored.every((value, index) => value === data[index])).toBe(true);
  expect(stores.get(WHISPER_BLOCK_CACHE)!.size).toBe(3);
  const block = [...stores.get(WHISPER_BLOCK_CACHE)!.keys()].find(k => k.includes('__wm_block'))!;
  stores.get(WHISPER_BLOCK_CACHE)!.delete(block);
  expect(await whisperResourceCache.match(key)).toBeUndefined();
});
it('cleans partial blocks and never marks a failed write as complete', async () => {
  const stores = setup(true); const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await expect(whisperResourceCache.put('https://example.com/model.onnx', new Response(new Uint8Array(5 * 1024 * 1024)))).rejects.toMatchObject({ name: 'QuotaExceededError' });
    expect(stores.get(WHISPER_BLOCK_CACHE)!.size).toBe(0);
  } finally { log.mockRestore(); }
});
