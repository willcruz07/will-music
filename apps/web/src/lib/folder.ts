import { parseChordPro } from './chart.ts';
import { type Song, db, now } from './db.ts';
import { exportSongs, importPackage, readPackage } from './package.ts';
import { SCORE_TYPES, buildScoreXml } from './score.ts';

/** The subset of the File System Access API this module uses (also implemented by the test double). */
export type FileLike = { kind: 'file'; name: string; getFile: () => Promise<File>; createWritable: () => Promise<{ write: (data: BlobPart) => Promise<void>; close: () => Promise<void> }> };
export type DirLike = {
  kind: 'directory';
  name: string;
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirLike>;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FileLike>;
  values: () => AsyncIterable<FileLike | DirLike>;
  queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

export type FoundFile = { path: string; name: string; kind: 'package' | 'chordpro' | 'musicxml'; file: () => Promise<File> };

const FOLDERS = { charts: 'Cifras', scores: 'Partituras', packages: 'Pacotes', backup: 'Backup' } as const;
const TYPE_FILE: Record<string, string> = { melody: 'melodia', guitar: 'guitarra', keys: 'teclado', drums: 'bateria', choir: 'coral' };

/** "Título - Artista" without the characters Windows, macOS, Android or iOS refuse in file names. */
export const displayName = (song: Pick<Song, 'title' | 'artist'>): string => {
  const clean = (s: string) => s.replace(/[\\/]/gu, ' ').replace(/[:*?"<>|]/gu, '').replace(/\s+/gu, ' ').trim();
  const title = clean(song.title) || 'Sem título';
  const artist = clean(song.artist);
  return artist ? `${title} - ${artist}` : title;
};

const subdir = async (root: DirLike, ...names: string[]): Promise<DirLike> => {
  let dir = root;
  for (const name of names) dir = await dir.getDirectoryHandle(name, { create: true });
  return dir;
};

const writeFile = async (dir: DirLike, name: string, data: BlobPart): Promise<void> => {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
};

/** Writes one song as plain files: its chart (.cho), every score it has (.musicxml) and a package (.willmusic.zip). */
export const writeSongToFolder = async (root: DirLike, songId: string, opts: { includeAudio: boolean }): Promise<void> => {
  const song = await db.songs.get(songId);
  if (!song) return;
  const name = displayName(song);
  const chart = await db.charts.where('songId').equals(songId).first();
  if (chart) {
    const dir = await subdir(root, FOLDERS.charts, ...(song.folder ? [displayName({ title: song.folder, artist: '' })] : []));
    await writeFile(dir, `${name}.cho`, chart.chordPro);
  }
  const [score, analysis] = await Promise.all([db.scores.get(songId), db.analyses.where('songId').equals(songId).first()]);
  for (const { type } of SCORE_TYPES) {
    const xml = buildScoreXml(type, song, analysis, score);
    if (xml) await writeFile(await subdir(root, FOLDERS.scores), `${name} (${TYPE_FILE[type]}).musicxml`, xml);
  }
  const pack = await exportSongs([songId], { includeAudio: opts.includeAudio, kind: 'song' });
  await writeFile(await subdir(root, FOLDERS.packages), `${name}.willmusic.zip`, pack);
};

/** Saves every song, then a light backup of all charts, scores and lists (no audio) to restore everything at once. */
export const writeAllToFolder = async (root: DirLike, opts: { includeAudio: boolean }, onProgress: (done: number, total: number) => void): Promise<void> => {
  const ids = (await db.songs.toCollection().primaryKeys()) as string[];
  for (const [i, id] of ids.entries()) {
    await writeSongToFolder(root, id, opts);
    onProgress(i + 1, ids.length);
  }
  const setlists = await db.setlists.toArray();
  const backup = await exportSongs(ids, { includeAudio: false, kind: 'backup', setlists });
  await writeFile(await subdir(root, FOLDERS.backup), 'will-music-backup.willmusic.zip', backup);
};

const kindOf = (name: string): FoundFile['kind'] | null => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.willmusic.zip')) return 'package';
  if (/\.(cho|chordpro|chopro|crd)$/u.test(lower)) return 'chordpro';
  if (/\.(musicxml|mxl|xml)$/u.test(lower) && !lower.endsWith('.mxl')) return 'musicxml';
  return null;
};

/** Every will-music file in a connected folder (recursively). */
export const scanFolder = async (root: DirLike, prefix = ''): Promise<FoundFile[]> => {
  const out: FoundFile[] = [];
  for await (const entry of root.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') out.push(...(await scanFolder(entry, path)));
    else {
      const kind = kindOf(entry.name);
      if (kind) out.push({ path, name: entry.name, kind, file: () => entry.getFile() });
    }
  }
  return out.sort((a, z) => a.path.localeCompare(z.path));
};

/** Same, from files picked with a folder input (phones and browsers without folder access). */
export const scanFileList = (files: Iterable<File>): FoundFile[] =>
  [...files]
    .map((f) => {
      const kind = kindOf(f.name);
      const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      return kind ? { path, name: f.name, kind, file: async () => f } : null;
    })
    .filter((f): f is FoundFile => !!f)
    .sort((a, z) => a.path.localeCompare(z.path));

/** Folder of a chart from its path: the part between "Cifras/" and the file name. */
const folderFromPath = (path: string): string | undefined => {
  const parts = path.split('/');
  const i = parts.indexOf(FOLDERS.charts);
  return i >= 0 && parts.length - i > 2 ? parts.slice(i + 1, -1).join(' / ') : undefined;
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Brings files back into the app: packages first (songs, charts, scores, lists, audio), then loose
 * ChordPro files for songs the app does not have yet. Nothing already in the app is duplicated by a chart.
 */
export const restoreFiles = async (
  found: readonly FoundFile[],
  resolve: (conflicts: Song[]) => Promise<'replace' | 'keep-both'>,
): Promise<{ songs: number; lists: number; skipped: number }> => {
  const restored = new Set<string>();
  let lists = 0;
  let skipped = 0;
  let decision: 'replace' | 'keep-both' | undefined;
  const ask = async (conflicts: Song[]) => (decision ??= await resolve(conflicts));
  for (const f of found.filter((x) => x.kind === 'package')) {
    try {
      const contents = await readPackage(await f.file());
      const result = await importPackage(contents, ask);
      contents.songs.forEach((s) => restored.add(s.song.id));
      lists += result.setlists.length;
    } catch {
      skipped++;
    }
  }
  for (const f of found.filter((x) => x.kind === 'chordpro')) {
    const text = await (await f.file()).text();
    const meta = parseChordPro(text).meta;
    const title = meta.title || f.name.replace(/\.[^.]+$/u, '');
    const artist = meta.artist ?? meta.subtitle ?? '';
    const existing = (await db.songs.toArray()).find((s) => same(s.title, title) && same(s.artist, artist));
    if (existing) {
      skipped++;
      continue;
    }
    const stamp = now();
    const song: Song = { id: crypto.randomUUID(), title, artist, durationSec: 0, favorite: false, analysisStatus: 'done', folder: folderFromPath(f.path), createdAt: stamp, updatedAt: stamp };
    await db.transaction('rw', db.songs, db.charts, async () => {
      await db.songs.add(song);
      await db.charts.add({ id: crypto.randomUUID(), songId: song.id, chordPro: text, transpose: 0, fontSize: 18, origin: 'manual', createdAt: stamp, updatedAt: stamp });
    });
    restored.add(song.id);
  }
  return { songs: restored.size, lists, skipped };
};

// ---- The connected folder (Chrome and Edge on computers) ----

type Picker = { showDirectoryPicker?: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<DirLike> };
export const supportsFolderAccess = (): boolean => typeof window !== 'undefined' && typeof (window as Window & Picker).showDirectoryPicker === 'function';

export const pickFolder = async (): Promise<DirLike> => {
  const handle = await (window as Window & Picker).showDirectoryPicker!({ id: 'will-music', mode: 'readwrite' });
  await db.settings.put({ key: 'folder', value: handle });
  return handle;
};

export const getFolder = async (): Promise<DirLike | undefined> => (await db.settings.get('folder'))?.value as DirLike | undefined;
export const forgetFolder = (): Promise<void> => db.settings.delete('folder');

/** Write access, asking the user only when `ask` is true (the browser requires a tap for that). */
export const folderAccess = async (dir: DirLike, ask: boolean): Promise<boolean> => {
  const opts = { mode: 'readwrite' as const };
  if ((await dir.queryPermission?.(opts)) === 'granted') return true;
  return ask ? (await dir.requestPermission?.(opts)) === 'granted' : false;
};

export const folderPrefs = async (): Promise<{ auto: boolean; audio: boolean }> => {
  const value = (await db.settings.get('folderPrefs'))?.value as Partial<{ auto: boolean; audio: boolean }> | undefined;
  return { auto: value?.auto ?? true, audio: value?.audio ?? true };
};
export const setFolderPrefs = (prefs: { auto: boolean; audio: boolean }): Promise<string> => db.settings.put({ key: 'folderPrefs', value: prefs });

/**
 * Keeps the connected folder up to date: whenever a song, its chart or its score changes, that song is
 * written again a few seconds later (only while the browser already allows writing; it never prompts).
 */
export const startFolderAutoSync = (delayMs = 3000): void => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const schedule = (songId: string | undefined) => {
    if (!songId) return;
    clearTimeout(timers.get(songId));
    timers.set(
      songId,
      setTimeout(() => {
        timers.delete(songId);
        void (async () => {
          const [dir, prefs] = await Promise.all([getFolder(), folderPrefs()]);
          if (!dir || !prefs.auto || !(await folderAccess(dir, false))) return;
          await writeSongToFolder(dir, songId, { includeAudio: prefs.audio });
        })().catch((e: unknown) => console.warn('Não foi possível salvar na pasta', e));
      }, delayMs),
    );
  };
  db.charts.hook('creating', (_pk, obj) => schedule(obj.songId));
  db.charts.hook('updating', (_mods, _pk, obj) => schedule(obj.songId));
  db.scores.hook('creating', (_pk, obj) => schedule(obj.songId));
  db.scores.hook('updating', (_mods, _pk, obj) => schedule(obj.songId));
  db.songs.hook('updating', (_mods, _pk, obj) => schedule(obj.id));
};
