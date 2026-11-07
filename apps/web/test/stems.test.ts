import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSong, db, deleteSong } from '../src/lib/db.ts';
import { MODE_INFO, availableModes, deleteStemSet, getStems, listStemSets, selectStemSet, separateSong } from '../src/lib/stems.ts';

const clear = () => Promise.all([db.songs.clear(), db.audio.clear(), db.stemSets.clear()]);
beforeEach(clear);
afterEach(() => vi.unstubAllGlobals());

const decode = async () => ({ planar: new Float32Array(8), samples: 4 });
const gpu = { requestAdapter: async () => ({}) };
const tracksOf = (names: string[]) => async () => Object.fromEntries(names.map((n) => [n, new ArrayBuffer(8)]));

describe('stem separation storage', () => {
  it('refuses without WebGPU and downloads nothing', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob(['x']));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(separateSong(song.id, () => {}, { gpu: undefined, decode })).rejects.toThrow(/precisa de um navegador com WebGPU/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('writes nothing when the separation fails', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob(['x']));
    const run = async () => {
      throw new Error('falhou no bloco 3');
    };
    await expect(separateSong(song.id, () => {}, { gpu, decode, run })).rejects.toThrow('falhou no bloco 3');
    expect(await getStems(song.id)).toBeUndefined();
    expect(await db.songs.get(song.id)).toBeTruthy();
  });

  it('stores the three voice tracks as MP3 and deleteSong removes them', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob(['x']));
    await separateSong(song.id, () => {}, { gpu, decode, run: tracksOf(['instrumental', 'lead', 'backing']) });
    const stems = await getStems(song.id);
    expect(stems!.mode).toBe('vocals');
    expect(stems!.tracks.map((t) => t.name)).toEqual(['instrumental', 'lead', 'backing']);
    expect(stems!.tracks[0]!.blob.type).toBe('audio/mpeg');
    await deleteSong(song.id);
    expect(await getStems(song.id)).toBeUndefined();
  });

  it('keeps one separation per mode and plays the last one chosen', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob(['x']));
    await separateSong(song.id, () => {}, { gpu, decode, run: tracksOf(['instrumental', 'lead', 'backing']) });
    await separateSong(song.id, () => {}, { gpu, decode, mode: 'six', run: tracksOf(['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']) });
    expect((await listStemSets(song.id)).map((s) => s.mode).sort()).toEqual(['six', 'vocals']);
    expect((await getStems(song.id))!.mode).toBe('six');
    await selectStemSet(song.id, 'vocals');
    expect((await getStems(song.id))!.mode).toBe('vocals');
    await deleteStemSet(song.id, 'vocals');
    expect((await getStems(song.id))!.mode).toBe('six');
  });

  it('rejects a run that misses a track of the mode', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob(['x']));
    await expect(separateSong(song.id, () => {}, { gpu, decode, mode: 'four', run: tracksOf(['vocals', 'drums']) })).rejects.toThrow(/incompleta/);
    expect(await getStems(song.id)).toBeUndefined();
  });

  it('describes every mode with its download', () => {
    expect(MODE_INFO.full.models).toEqual(['demucs6s', 'kara2Core', 'kara2Data']);
    expect(MODE_INFO.four.downloadBytes).toBe(MODE_INFO.six.downloadBytes);
    expect(availableModes()).toEqual(['vocals', 'four', 'six', 'full']);
  });
});

describe('review fixes: separation', () => {
  it('checks for a real WebGPU adapter before downloading', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob(['x']));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(separateSong(song.id, () => {}, { gpu: { requestAdapter: async () => null }, decode })).rejects.toThrow(/precisa de um navegador com WebGPU/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('explains a full storage in Portuguese', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob(['x']));
    const original = db.stemSets.put.bind(db.stemSets);
    db.stemSets.put = (() => Promise.reject(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }))) as unknown as typeof db.stemSets.put;
    await expect(separateSong(song.id, () => {}, { gpu, decode, run: tracksOf(['instrumental', 'lead', 'backing']) })).rejects.toThrow(/não deixou guardar/);
    db.stemSets.put = original;
  });
});
