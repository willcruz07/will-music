import { MODELS } from '@will-music/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteCachedModels, listCachedModels } from '../src/lib/models.ts';
import { formatBytes, storageStatus } from '../src/lib/storage.ts';

afterEach(() => vi.unstubAllGlobals());

describe('storage helpers', () => {
  it('formats sizes in Portuguese', () => {
    expect(formatBytes(17080550)).toBe('17 MB');
    expect(formatBytes(850000)).toBe('850 KB');
    expect(formatBytes(1.2e9)).toBe('1,2 GB');
    expect(formatBytes(0)).toBe('0 KB');
  });

  it('reports no persistence without the storage API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await storageStatus()).toEqual({ persisted: false });
  });

  it('lists and deletes cached models', async () => {
    const store = new Map<string, Response>([[MODELS.skey.url, new Response(new Uint8Array(338482))], ['https://outra.coisa/x', new Response('x')]]);
    const cache = {
      keys: async () => [...store.keys()].map((url) => new Request(url)),
      match: async (r: Request | string) => store.get(typeof r === 'string' ? r : r.url)?.clone(),
    };
    let deleted = '';
    vi.stubGlobal('caches', { open: async () => cache, delete: async (name: string) => ((deleted = name), true) });
    expect(await listCachedModels()).toEqual([{ id: 'skey', bytes: 338482 }]);
    await deleteCachedModels();
    expect(deleted).toBe('wm-models-v1');
  });
});
