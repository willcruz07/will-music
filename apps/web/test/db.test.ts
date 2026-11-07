import { beforeEach, describe, expect, it } from 'vitest';
import { createSong, db, deleteSong, listSongs, updateSong } from '../src/lib/db.ts';

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
});

describe('local database', () => {
  it('creates, lists and deletes a song with its audio', async () => {
    const s = await createSong({ title: 'Imperfeito', artist: 'Coral', durationSec: 294.8 }, new Blob(['x'], { type: 'audio/mpeg' }));
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.analysisStatus).toBe('pending');
    expect(s.favorite).toBe(false);
    expect((await listSongs()).map((x) => x.title)).toEqual(['Imperfeito']);
    expect(await db.audio.get(s.id)).toBeTruthy();
    await db.charts.add({ id: 'c1', songId: s.id, chordPro: '', transpose: 0, fontSize: 18, origin: 'generated', createdAt: '', updatedAt: '' });
    await deleteSong(s.id);
    expect(await listSongs()).toEqual([]);
    expect(await db.audio.get(s.id)).toBeUndefined();
    expect(await db.charts.where('songId').equals(s.id).count()).toBe(0);
  });

  it('bumps updatedAt on update and lists newest first', async () => {
    const a = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob());
    await new Promise((r) => setTimeout(r, 5));
    const b = await createSong({ title: 'B', artist: '', durationSec: 1 }, new Blob());
    expect((await listSongs()).map((x) => x.title)).toEqual(['B', 'A']);
    await new Promise((r) => setTimeout(r, 5));
    await updateSong(a.id, { key: 'G' });
    const updated = await db.songs.get(a.id);
    expect(updated!.key).toBe('G');
    expect(updated!.updatedAt > b.updatedAt).toBe(true);
    expect((await listSongs())[0]!.title).toBe('A');
  });
});
