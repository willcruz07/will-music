import { MODELS } from '@will-music/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSong, db } from '../src/lib/db.ts';
import { fetchModel } from '../src/lib/models.ts';
import { explainQuota, isQuotaError } from '../src/lib/storage.ts';
import { separateSong } from '../src/lib/stems.ts';

const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

beforeEach(() => Promise.all([db.songs.clear(), db.audio.clear(), db.stemSets.clear()]));
afterEach(() => vi.unstubAllGlobals());

describe('storage quota', () => {
  it('still returns a verified model when the browser refuses to cache it', async () => {
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async () => undefined,
        put: async () => {
          throw new DOMException('Quota exceeded.', 'QuotaExceededError');
        },
      }),
    });
    const bytes = new TextEncoder().encode('modelo grande');
    const original = MODELS.skey.sha256;
    MODELS.skey.sha256 = await sha256(bytes);
    const out = await fetchModel('skey', undefined, async () => new Response(bytes));
    expect(Array.from(out)).toEqual(Array.from(bytes));
    MODELS.skey.sha256 = original;
  });

  it('recognises quota errors, also when they arrive as worker text', () => {
    expect(isQuotaError(new DOMException('x', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError(new Error('Quota exceeded.'))).toBe(true);
    expect(isQuotaError(new Error('falhou no bloco 3'))).toBe(false);
  });

  it('explains the limit in Portuguese with the numbers and the private-window hint', () => {
    const text = explainQuota({ usage: 280e6, quota: 300e6 });
    expect(text).toMatch(/não deixou guardar/);
    expect(text).toMatch(/280 MB de 300 MB/);
    expect(text).toMatch(/janela anônima/);
  });

  it('stops before downloading when there is clearly not enough room', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 240 }, new Blob(['x']));
    const run = vi.fn();
    await expect(
      separateSong(song.id, () => {}, {
        mode: 'six',
        gpu: { requestAdapter: async () => ({}) },
        decode: async () => ({ planar: new Float32Array(8), samples: 4 }),
        run,
        storage: { estimate: async () => ({ usage: 100e6, quota: 300e6 }) },
        cachedModels: async () => [],
      }),
    ).rejects.toThrow(/não deixou guardar|não há espaço/);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('separation error details', () => {
  it('says which step failed and keeps the browser text', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 10 }, new Blob(['x']));
    const run = async () => {
      throw new Error('baixar o modelo de separação: QuotaExceededError: Quota exceeded.');
    };
    const error = await separateSong(song.id, () => {}, { gpu: { requestAdapter: async () => ({}) }, decode: async () => ({ planar: new Float32Array(8), samples: 4 }), run, cachedModels: async () => [] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/baixar o modelo de separação/);
    expect((error as Error).message).toMatch(/Detalhe técnico: .*Quota exceeded/);
  });

  it('names the saving step when the tracks cannot be stored', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 10 }, new Blob(['x']));
    const original = db.stemSets.put.bind(db.stemSets);
    db.stemSets.put = (() => Promise.reject(new DOMException('Quota exceeded.', 'QuotaExceededError'))) as unknown as typeof db.stemSets.put;
    const error = await separateSong(song.id, () => {}, {
      gpu: { requestAdapter: async () => ({}) },
      decode: async () => ({ planar: new Float32Array(8), samples: 4 }),
      run: async () => ({ instrumental: new ArrayBuffer(8), lead: new ArrayBuffer(8), backing: new ArrayBuffer(8) }),
      cachedModels: async () => [],
    }).catch((e: unknown) => e);
    db.stemSets.put = original;
    expect((error as Error).message).toMatch(/guardar as faixas/);
  });
});
