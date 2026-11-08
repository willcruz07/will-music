import { MODELS } from '@will-music/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchModel } from '../src/lib/models.ts';

const store = new Map<string, Response>();
const fakeCaches = {
  open: async () => ({
    match: async (url: string) => store.get(url)?.clone(),
    put: async (url: string, response: Response) => void store.set(url, new Response(await response.arrayBuffer())),
    delete: async (url: string) => store.delete(url),
    keys: async () => [...store.keys()].map((url) => new Request(url)),
  }),
};

const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

beforeEach(() => {
  store.clear();
  vi.stubGlobal('caches', fakeCaches);
});

describe('fetchModel', () => {
  it('streams a download into the cache without hashing the whole model in one buffer (iPad memory)', async () => {
    const bytes = new TextEncoder().encode('modelo grande'.repeat(1000));
    const original = MODELS.skey.sha256;
    MODELS.skey.sha256 = await sha256(bytes);
    const digest = vi.spyOn(crypto.subtle, 'digest');
    const out = await fetchModel('skey', undefined, vi.fn(async () => new Response(bytes)));
    expect(out.length).toBe(bytes.length);
    expect(digest).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
    digest.mockRestore();
    MODELS.skey.sha256 = original;
  });

  it('downloads once, verifies the hash and serves later calls from the cache', async () => {
    const bytes = new TextEncoder().encode('modelo de teste');
    const original = MODELS.skey.sha256;
    MODELS.skey.sha256 = await sha256(bytes);
    const fetchFn = vi.fn(async () => new Response(bytes));
    const progress: number[] = [];
    const first = await fetchModel('skey', (loaded) => progress.push(loaded), fetchFn);
    expect(Array.from(first)).toEqual(Array.from(bytes));
    expect(progress.at(-1)).toBe(bytes.length);
    const second = await fetchModel('skey', undefined, fetchFn);
    expect(Array.from(second)).toEqual(Array.from(bytes));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    MODELS.skey.sha256 = original;
  });

  it('rejects and caches nothing when the hash does not match', async () => {
    const fetchFn = vi.fn(async () => new Response(new TextEncoder().encode('corrompido')));
    await expect(fetchModel('chordnet', undefined, fetchFn)).rejects.toThrow(/Modelo corrompido: chordnet/);
    expect(store.size).toBe(0);
  });

  it('reports a clear error when the download fails', async () => {
    const fetchFn = vi.fn(async () => new Response('x', { status: 503 }));
    await expect(fetchModel('chordnet', undefined, fetchFn)).rejects.toThrow(/Não foi possível baixar o modelo chordnet/);
  });
});
