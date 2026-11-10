import { transposeKey } from './transpose.ts';
import { type Chart, type Setlist, type SetlistItem, type Song, db, now } from './db.ts';

export const createSetlist = async (name: string): Promise<Setlist> => {
  const stamp = now();
  const setlist: Setlist = { id: crypto.randomUUID(), name, items: [], createdAt: stamp, updatedAt: stamp };
  await db.setlists.add(setlist);
  return setlist;
};

/** Create and link in one write, so a failed add cannot leave an empty list behind. */
export const createSetlistWithSong = async (name: string, songId: string): Promise<Setlist> => {
  if (!name.trim()) throw new Error('Informe um nome para a lista.');
  const stamp = now();
  const list: Setlist = { id: crypto.randomUUID(), name: name.trim(), items: [{ songId }], createdAt: stamp, updatedAt: stamp };
  await db.transaction('rw', db.songs, db.setlists, async () => {
    if (!(await db.songs.get(songId))) throw new Error('Esta cifra foi removida da biblioteca.');
    await db.setlists.add(list);
  });
  return list;
};

export const updateSetlist = async (id: string, patch: Partial<Omit<Setlist, 'id' | 'createdAt'>>): Promise<void> => {
  await db.setlists.update(id, { ...patch, updatedAt: now() });
};

export const deleteSetlist = (id: string): Promise<void> => db.setlists.delete(id);

export const listSetlists = (): Promise<Setlist[]> => db.setlists.orderBy('updatedAt').reverse().toArray();

export const addToSetlist = async (id: string, songId: string): Promise<void> => {
  await db.transaction('rw', db.setlists, async () => {
    const setlist = await db.setlists.get(id);
    if (!setlist) throw new Error('Esta lista foi removida. Abra a seleção novamente.');
    await updateSetlist(id, { items: [...setlist.items, { songId }] });
  });
};

export const moveItem = (items: readonly SetlistItem[], from: number, to: number): SetlistItem[] => {
  const out = [...items];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length) return out;
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved!);
  return out;
};

/** Each item with its song and chart; songs deleted from the library come back as `song: undefined`. */
export const resolveItems = async (setlist: Setlist): Promise<{ item: SetlistItem; song?: Song; chart?: Chart }[]> =>
  Promise.all(
    setlist.items.map(async (item) => ({
      item,
      song: await db.songs.get(item.songId),
      chart: await db.charts.where('songId').equals(item.songId).first(),
    })),
  );

/** The 12 keys of the song's mode, starting at its key, spelled like the rest of the app. */
export const keyOptions = (songKey: string): string[] => Array.from({ length: 12 }, (_, i) => transposeKey(songKey, i));
