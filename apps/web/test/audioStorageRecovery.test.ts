import { Blob as NativeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSong, db, getAudioImportAttempts } from '../src/lib/db.ts';
import { isQuotaError } from '../src/lib/storage.ts';

beforeEach(async () => {
  vi.stubGlobal('Blob', NativeBlob);
  await Promise.all([db.songs.clear(), db.audio.clear()]);
});
afterEach(() => vi.unstubAllGlobals());

const input = { title: 'Teste', artist: 'Artista', durationSec: 10 };
const quota = () => Object.assign(new Error('Transação cancelada'), { name: 'AbortError', inner: { name: 'QuotaExceededError' } });

describe('original audio storage recovery', () => {
  it('waits for the first persistence request before starting the audio write', async () => {
    let grant: (value: boolean) => void = () => {};
    const pending = new Promise<boolean>((resolve) => { grant = resolve; });
    const persist = vi.fn(() => pending);
    vi.stubGlobal('navigator', { storage: { persist } });
    const creating = vi.fn();
    db.songs.hook('creating', creating);
    const saving = createSong(input, new Blob(['audio']));
    try {
      await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
      expect(creating).not.toHaveBeenCalled();
      grant(true);
      await saving;
      expect(creating).toHaveBeenCalledTimes(1);
    } finally { grant(false); db.songs.hook('creating').unsubscribe(creating); }
  });

  it('retries a refused Blob as binary, keeping the exact audio and one complete song', async () => {
    const attempts: string[] = [];
    const failBlob = (_key: unknown, record: { blob: unknown }) => {
      attempts.push(record.blob instanceof Blob ? 'blob' : 'binary');
      if (record.blob instanceof Blob) throw quota();
    };
    db.audio.hook('creating', failBlob);
    try {
      const audio = new Blob(['mp3-bytes-ç'], { type: 'audio/mpeg' });
      const song = await createSong(input, audio);
      const saved = await db.audio.get(song.id);
      expect(attempts).toEqual(['blob', 'binary']);
      expect(await db.songs.count()).toBe(1);
      expect(await db.audio.count()).toBe(1);
      expect(saved!.blob).toBeInstanceOf(Blob);
      expect(saved!.blob.type).toBe('audio/mpeg');
      expect(await saved!.blob.text()).toBe(await audio.text());
    } finally {
      db.audio.hook('creating').unsubscribe(failBlob);
    }
  });

  it('rolls back both attempts when storage really refuses all writes', async () => {
    const fail = vi.fn(() => { throw quota(); });
    db.audio.hook('creating', fail);
    try {
      const error = await createSong(input, new Blob(['audio'])).catch((error: unknown) => error);
      expect(error).toMatchObject({ name: 'AbortError' });
      expect(getAudioImportAttempts(error).map(({ format, stage }) => ({ format, stage }))).toEqual([
        { format: 'blob', stage: 'audio' }, { format: 'binary', stage: 'audio' },
      ]);
      expect(fail).toHaveBeenCalledTimes(2);
      expect(await db.songs.count()).toBe(0);
      expect(await db.audio.count()).toBe(0);
    } finally {
      db.audio.hook('creating').unsubscribe(fail);
    }
  });

  it('does not retry unrelated failures or leave an incomplete song', async () => {
    const fail = vi.fn(() => { throw new Error('Falha diferente'); });
    db.audio.hook('creating', fail);
    try {
      await expect(createSong(input, new Blob(['audio']))).rejects.toThrow('Falha diferente');
      expect(fail).toHaveBeenCalledTimes(1);
      expect(await db.songs.count()).toBe(0);
    } finally {
      db.audio.hook('creating').unsubscribe(fail);
    }
  });

  it('keeps large audio out of the full-memory binary retry', async () => {
    const fail = vi.fn(() => { throw quota(); });
    db.audio.hook('creating', fail);
    try {
      const audio = new Blob(['x']);
      Object.defineProperty(audio, 'size', { value: 65 * 1024 * 1024 });
      await expect(createSong(input, audio)).rejects.toMatchObject({ name: 'AbortError' });
      expect(fail).toHaveBeenCalledTimes(1);
    } finally {
      db.audio.hook('creating').unsubscribe(fail);
    }
  });

  it('recognizes nested Dexie quota errors, including cyclic error chains', () => {
    expect(isQuotaError(quota())).toBe(true);
    const cyclic: { inner?: unknown } = {};
    cyclic.inner = cyclic;
    expect(isQuotaError(cyclic)).toBe(false);
    expect(isQuotaError({ cause: quota() })).toBe(true);
  });
});
