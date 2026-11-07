import { beforeEach, describe, expect, it } from 'vitest';
import { createSong, db, deleteSong } from '../src/lib/db.ts';
import { addToSetlist, createSetlist, deleteSetlist, listSetlists, moveItem, resolveItems, updateSetlist } from '../src/lib/setlists.ts';

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear(), db.setlists.clear()]);
});

describe('setlists', () => {
  it('creates, renames, lists and deletes', async () => {
    const s = await createSetlist('Culto de domingo');
    expect(s.items).toEqual([]);
    await updateSetlist(s.id, { name: 'Culto da noite', date: '2026-11-09' });
    expect((await listSetlists()).map((x) => [x.name, x.date])).toEqual([['Culto da noite', '2026-11-09']]);
    await deleteSetlist(s.id);
    expect(await listSetlists()).toEqual([]);
  });

  it('allows the same song twice', async () => {
    const song = await createSong({ title: 'A', artist: '', durationSec: 1 }, new Blob());
    const s = await createSetlist('L');
    await addToSetlist(s.id, song.id);
    await addToSetlist(s.id, song.id);
    expect((await db.setlists.get(s.id))!.items).toHaveLength(2);
  });

  it('moves items', () => {
    const a = { songId: 'a' }, b = { songId: 'b' }, c = { songId: 'c' };
    expect(moveItem([a, b, c], 0, 2)).toEqual([b, c, a]);
    expect(moveItem([a, b, c], 2, 0)).toEqual([c, a, b]);
    expect(moveItem([a, b, c], 5, 0)).toEqual([a, b, c]);
  });

  it('keeps items of deleted songs as missing', async () => {
    const keep = await createSong({ title: 'Fica', artist: '', durationSec: 1 }, new Blob());
    const gone = await createSong({ title: 'Sai', artist: '', durationSec: 1 }, new Blob());
    const s = await createSetlist('L');
    await addToSetlist(s.id, gone.id);
    await addToSetlist(s.id, keep.id);
    await deleteSong(gone.id);
    const resolved = await resolveItems((await db.setlists.get(s.id))!);
    expect(resolved.map((r) => r.song?.title)).toEqual([undefined, 'Fica']);
  });
});
