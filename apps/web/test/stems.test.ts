import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSong, db, deleteSong } from '../src/lib/db.ts';
import { getStems, separateSong } from '../src/lib/stems.ts';

const clear = () => Promise.all([db.songs.clear(), db.audio.clear(), db.stems.clear()]);
beforeEach(clear);
afterEach(() => vi.unstubAllGlobals());

const decode = async () => ({ planar: new Float32Array(8), samples: 4 });

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
    await expect(separateSong(song.id, () => {}, { gpu: {}, decode, run })).rejects.toThrow('falhou no bloco 3');
    expect(await getStems(song.id)).toBeUndefined();
    expect(await db.songs.get(song.id)).toBeTruthy();
  });

  it('stores the three tracks and deleteSong removes them', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob(['x']));
    const run = async () => ({ instrumental: new Float32Array(8), lead: new Float32Array(8), backing: new Float32Array(8) });
    await separateSong(song.id, () => {}, { gpu: {}, decode, run });
    const stems = await getStems(song.id);
    expect(stems!.tracks.map((t) => t.name)).toEqual(['instrumental', 'lead', 'backing']);
    await deleteSong(song.id);
    expect(await getStems(song.id)).toBeUndefined();
  });
});
