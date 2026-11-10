import { describe, expect, it } from 'vitest';
import { getSessionStems, retainSessionStems, setSessionStems } from '../src/lib/sessionStems.ts';
import { createSong, db, type StemsRecord } from '../src/lib/db.ts';
import { separateSong } from '../src/lib/stems.ts';

describe('temporary separated tracks', () => {
  it('shares tracks between a job and player, then releases them after the last owner leaves', () => {
    const record: StemsRecord = { songId: 'session', mode: 'six', model: '', sampleRate: 44100, tracks: [], createdAt: '', selectedAt: '' };
    let changes = 0;
    const releaseJob = retainSessionStems(record.songId);
    const releasePlayer = retainSessionStems(record.songId, () => { changes++; });
    setSessionStems(record.songId, record);
    expect(changes).toBe(1);
    releasePlayer();
    expect(getSessionStems(record.songId)).toBe(record);
    releasePlayer(); // idempotent cleanup
    releaseJob();
    expect(getSessionStems(record.songId)).toBeUndefined();
  });

  it('separates without writing tracks or reserving output quota in session mode', async () => {
    const song = await createSong({ title: 'Session', artist: '', durationSec: 1 }, new Blob(['audio']));
    const result = await separateSong(song.id, () => {}, {
      mode: 'six', persist: false,
      gpu: { requestAdapter: async () => ({}) },
      cachedModels: async () => [{ id: 'demucs6s' }],
      storage: { estimate: async () => ({ usage: 100, quota: 100 }) },
      decode: async () => ({ planar: new Float32Array(8), samples: 4 }),
      run: async () => Object.fromEntries(['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'].map((name) => [name, new ArrayBuffer(8)])),
    });
    expect(result.persisted).toBe(false);
    expect(result.record.tracks).toHaveLength(6);
    expect(await db.stemSets.where('songId').equals(song.id).count()).toBe(0);
    await db.audio.delete(song.id);
    await db.songs.delete(song.id);
  });
});
