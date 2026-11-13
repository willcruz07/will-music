import { strFromU8, unzipSync, zipSync } from 'fflate';
import { parseChordPro } from './chart.ts';
import { type Song, db, now } from './db.ts';
import { chartLineStarts, lyricTexts } from './lineTimes.ts';
import { exportSongs, importPackage, readPackage } from './package.ts';
import { SCORE_TYPES, buildScoreXml } from './score.ts';

/** The subset of the File System Access API this module uses (also implemented by the test double). */
export type FileLike = { kind: 'file'; name: string; getFile: () => Promise<File>; createWritable: () => Promise<{ write: (data: BlobPart) => Promise<void>; close: () => Promise<void> }> };
export type DirLike = {
  kind: 'directory';
  name: string;
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirLike>;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FileLike>;
  removeEntry?: (name: string) => Promise<void>;
  values: () => AsyncIterable<FileLike | DirLike>;
  queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

export type FoundFile = { path: string; name: string; kind: 'package' | 'chordpro' | 'musicxml'; file: () => Promise<File> };

const FOLDERS = { charts: 'Cifras', scores: 'Partituras', packages: 'Pacotes', backup: 'Backup', trash: 'Lixeira' } as const;
const TYPE_FILE: Record<string, string> = { melody: 'melodia', guitar: 'guitarra', keys: 'teclado', drums: 'bateria', choir: 'coral' };
const BACKUP_FILE = 'will-music-backup.willmusic.zip';

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/iu;

/** "Título - Artista" without the characters (or names) Windows, macOS, Android or iOS refuse. */
export const displayName = (song: Pick<Song, 'title' | 'artist'>): string => {
  const clean = (s: string) =>
    s
      .replace(/[\\/]/gu, ' ')
      .replace(/[:*?"<>|]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .replace(/[. ]+$/u, '');
  let title = clean(song.title) || 'Sem título';
  if (RESERVED.test(title)) title = `${title}_`;
  const artist = clean(song.artist);
  return (artist ? `${title} - ${artist}` : title).slice(0, 120);
};

/** File base name of a song: its readable name plus a short piece of its id, so two "Aleluia" never share files. */
export const fileBase = (song: Pick<Song, 'id' | 'title' | 'artist'>): string => `${displayName(song)} [${song.id.slice(0, 6)}]`;
const TAG = /\[([0-9a-f]{6})\]/iu;

const subdir = async (root: DirLike, ...names: string[]): Promise<DirLike> => {
  let dir = root;
  for (const name of names) dir = await dir.getDirectoryHandle(name, { create: true });
  return dir;
};
const existingDir = async (root: DirLike, ...names: string[]): Promise<DirLike | null> => {
  try {
    let dir = root;
    for (const name of names) dir = await dir.getDirectoryHandle(name);
    return dir;
  } catch {
    return null;
  }
};

const writeFile = async (dir: DirLike, name: string, data: BlobPart): Promise<void> => {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
};
const readFile = async (dir: DirLike | null, name: string): Promise<File | null> => {
  if (!dir) return null;
  try {
    return await (await dir.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
};
const removeFile = async (dir: DirLike | null, name: string): Promise<void> => {
  try {
    await dir?.removeEntry?.(name);
  } catch {
    /* already gone */
  }
};

/** Where each song's files were written last time (to clean up after a rename or a folder change). */
type Written = { base: string; folder?: string; scores: string[] };
const writtenMap = async (): Promise<Record<string, Written>> => ((await db.settings.get('folderNames'))?.value as Record<string, Written> | undefined) ?? {};
const saveWritten = async (songId: string, value: Written | null) => {
  const map = await writtenMap();
  if (value) map[songId] = value;
  else delete map[songId];
  await db.settings.put({ key: 'folderNames', value: map });
};

const removeSongFiles = async (root: DirLike, w: Written) => {
  await removeFile(await existingDir(root, FOLDERS.charts, ...(w.folder ? [w.folder] : [])), `${w.base}.cho`);
  const scores = await existingDir(root, FOLDERS.scores);
  for (const s of w.scores) await removeFile(scores, s);
  await removeFile(await existingDir(root, FOLDERS.packages), `${w.base}.willmusic.zip`);
};

/**
 * A package without audio for a song whose previous package had it (e.g. after "Manter só a cifra"):
 * keep the audio from the old file, so the folder never loses the only copy of it.
 */
const keepOldAudio = async (fresh: Blob, old: File | null, songId: string): Promise<Blob> => {
  if (!old) return fresh;
  const base = `songs/${songId}/`;
  let previous: Record<string, Uint8Array>;
  try {
    previous = unzipSync(new Uint8Array(await old.arrayBuffer()), { filter: (f) => f.name.startsWith(`${base}audio`) });
  } catch {
    return fresh;
  }
  if (!Object.keys(previous).length) return fresh;
  const files = unzipSync(new Uint8Array(await fresh.arrayBuffer()));
  if (Object.keys(files).some((p) => p.startsWith(`${base}audio`))) return fresh;
  return new Blob([zipSync({ ...files, ...previous }, { level: 0 })], { type: 'application/zip' });
};

const lyricsOf = async (songId: string) => {
  const [chart, analysis] = await Promise.all([db.charts.where('songId').equals(songId).first(), db.analyses.where('songId').equals(songId).first()]);
  if (!chart) return [];
  const starts = chartLineStarts(chart, analysis?.lyrics?.lines);
  return lyricTexts(chart.chordPro).map((text, i) => ({ time: starts[i] ?? 0, text }));
};

/** Writes one song as plain files: its chart (.cho), every score it has (.musicxml) and a package (.willmusic.zip). */
export const writeSongToFolder = async (root: DirLike, songId: string, opts: { includeAudio: boolean }): Promise<void> => {
  const song = await db.songs.get(songId);
  if (!song) return;
  const base = fileBase(song);
  const folder = song.folder ? displayName({ title: song.folder, artist: '' }) : undefined;
  const previous = (await writtenMap())[songId];
  const scoresWritten: string[] = [];

  const chart = await db.charts.where('songId').equals(songId).first();
  if (chart) await writeFile(await subdir(root, FOLDERS.charts, ...(folder ? [folder] : [])), `${base}.cho`, chart.chordPro);
  const [score, analysis, lyrics] = await Promise.all([db.scores.get(songId), db.analyses.where('songId').equals(songId).first(), lyricsOf(songId)]);
  for (const { type } of SCORE_TYPES) {
    const xml = buildScoreXml(type, song, analysis, score, { lyrics });
    if (!xml) continue;
    const name = `${base} (${TYPE_FILE[type]}).musicxml`;
    await writeFile(await subdir(root, FOLDERS.scores), name, xml);
    scoresWritten.push(name);
  }
  const packages = await subdir(root, FOLDERS.packages);
  let pack = await exportSongs([songId], { includeAudio: opts.includeAudio, kind: 'song' });
  if (opts.includeAudio && !(await db.audio.get(songId))) {
    pack = await keepOldAudio(pack, (await readFile(packages, `${base}.willmusic.zip`)) ?? (previous ? await readFile(packages, `${previous.base}.willmusic.zip`) : null), songId);
  }
  await writeFile(packages, `${base}.willmusic.zip`, pack);

  // Renamed or moved: the files under the old name go away (their content is now under the new name).
  if (previous && (previous.base !== base || previous.folder !== folder)) await removeSongFiles(root, { ...previous, scores: previous.scores.filter((s) => !scoresWritten.includes(s)) });
  else if (previous) for (const s of previous.scores.filter((x) => !scoresWritten.includes(x))) await removeFile(await existingDir(root, FOLDERS.scores), s);
  await saveWritten(songId, { base, folder, scores: scoresWritten });
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
  await writeFile(await subdir(root, FOLDERS.backup), BACKUP_FILE, backup);
};

const kindOf = (name: string): FoundFile['kind'] | null => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.willmusic.zip')) return 'package';
  if (/\.(cho|chordpro|chopro|crd)$/u.test(lower)) return 'chordpro';
  if (/\.(musicxml|xml)$/u.test(lower)) return 'musicxml';
  return null;
};

/** Every will-music file in a connected folder (recursively; the trash is left out). */
export const scanFolder = async (root: DirLike, prefix = ''): Promise<FoundFile[]> => {
  const out: FoundFile[] = [];
  for await (const entry of root.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') {
      if (!prefix && entry.name === FOLDERS.trash) continue;
      out.push(...(await scanFolder(entry, path)));
    } else {
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
      return kind && !path.split('/').includes(FOLDERS.trash) ? { path, name: f.name, kind, file: async () => f } : null;
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

/** Song ids in a package without unpacking the audio. */
const peekSongs = async (file: File): Promise<{ ids: string[]; backup: boolean } | null> => {
  try {
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => f.name === 'manifest.json' });
    const manifest = JSON.parse(strFromU8(entries['manifest.json']!)) as { songIds?: string[]; kind?: string };
    return { ids: manifest.songIds ?? [], backup: manifest.kind === 'backup' };
  } catch {
    return null;
  }
};

let restoring = 0;
/** True while files are being restored: automatic saving waits, so a restore is not written straight back. */
export const isRestoring = (): boolean => restoring > 0;

/**
 * Brings files back into the app:
 * 1. per-song packages (songs, charts, scores, audio), asking once about songs already in the app;
 * 2. the light backup, only for songs no package brought and lists not in the app yet;
 * 3. loose ChordPro files for songs the app still does not have.
 * Restoring the same folder twice never duplicates songs or lists.
 */
export const restoreFiles = async (
  found: readonly FoundFile[],
  resolve: (conflicts: Song[]) => Promise<'replace' | 'keep-both'>,
): Promise<{ songs: number; lists: number; skipped: number }> => {
  restoring++;
  try {
    const packages: { f: FoundFile; ids: string[]; backup: boolean }[] = [];
    let skipped = 0;
    for (const f of found.filter((x) => x.kind === 'package')) {
      const peek = await peekSongs(await f.file());
      if (peek) packages.push({ f, ...peek });
      else skipped++;
    }
    const perSong = packages.filter((p) => !p.backup);
    const backups = packages.filter((p) => p.backup);
    // One question for every song already on the device, before anything is written.
    const incoming = [...new Set(perSong.flatMap((p) => p.ids))];
    const conflicts = (await Promise.all(incoming.map((id) => db.songs.get(id)))).filter((s): s is Song => !!s);
    const decision = conflicts.length ? await resolve(conflicts) : 'replace';
    const restored = new Set<string>();
    let lists = 0;
    for (const p of perSong) {
      try {
        const contents = await readPackage(await p.f.file());
        await importPackage(contents, async () => decision, { skipSongIds: restored, skipExistingSetlists: true });
        contents.songs.forEach((s) => restored.add(s.song.id));
      } catch {
        skipped++;
      }
    }
    for (const p of backups) {
      try {
        const contents = await readPackage(await p.f.file());
        // From the backup, only what the packages did not bring (and never over a song already on the device).
        const onDevice = new Set(((await db.songs.toCollection().primaryKeys()) as string[]).filter((id) => !restored.has(id)));
        const skip = new Set([...restored, ...(decision === 'replace' ? [] : onDevice)]);
        const result = await importPackage(contents, async () => 'replace', { skipSongIds: skip, skipExistingSetlists: true });
        contents.songs.filter((s) => !skip.has(s.song.id)).forEach((s) => restored.add(s.song.id));
        lists += result.setlists.length;
      } catch {
        skipped++;
      }
    }
    const known = (await db.songs.toArray()).map((s) => ({ id: s.id, title: s.title, artist: s.artist }));
    for (const f of found.filter((x) => x.kind === 'chordpro')) {
      try {
        const tag = TAG.exec(f.name)?.[1]?.toLowerCase();
        if (tag && known.some((s) => s.id.startsWith(tag))) continue; // its song is already here (written by the app)
        const text = await (await f.file()).text();
        const meta = parseChordPro(text).meta;
        const fromName = f.name.replace(/\.[^.]+$/u, '').replace(TAG, '').trim();
        const [nameTitle = fromName, nameArtist = ''] = fromName.split(' - ');
        const title = meta.title || nameTitle;
        const artist = meta.artist ?? meta.subtitle ?? nameArtist;
        if (known.some((s) => same(s.title, title) && same(s.artist, artist))) {
          skipped++;
          continue;
        }
        const stamp = now();
        const song: Song = { id: crypto.randomUUID(), title, artist, durationSec: 0, favorite: false, analysisStatus: 'done', folder: folderFromPath(f.path), createdAt: stamp, updatedAt: stamp };
        await db.transaction('rw', db.songs, db.charts, async () => {
          await db.songs.add(song);
          await db.charts.add({ id: crypto.randomUUID(), songId: song.id, chordPro: text, transpose: 0, fontSize: 18, origin: 'manual', createdAt: stamp, updatedAt: stamp });
        });
        known.push({ id: song.id, title, artist });
        restored.add(song.id);
      } catch {
        skipped++;
      }
    }
    return { songs: restored.size, lists, skipped };
  } finally {
    restoring--;
  }
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

const PENDING = 'folderPending';
const readPending = async (): Promise<string[]> => ((await db.settings.get(PENDING))?.value as string[] | undefined) ?? [];
const writePending = (ids: string[]) => db.settings.put({ key: PENDING, value: [...new Set(ids)] });

/**
 * Automatic saving to the connected folder. Changes are written one song at a time (a single queue, so
 * big packages never pile up in memory); a change made while the browser does not allow writing is
 * remembered and written once access is granted again.
 */
export const createFolderSync = ({ delayMs = 3000, getDir = getFolder }: { delayMs?: number; getDir?: () => Promise<DirLike | undefined> } = {}) => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let chain: Promise<void> = Promise.resolve();
  const queued = new Set<string>();

  const write = (songId: string) => {
    if (queued.has(songId)) return chain;
    queued.add(songId);
    chain = chain
      .then(async () => {
        queued.delete(songId);
        const [dir, prefs] = await Promise.all([getDir(), folderPrefs()]);
        if (!dir || !prefs.auto) return;
        if (!(await folderAccess(dir, false))) {
          await writePending([...(await readPending()), songId]);
          return;
        }
        if (!(await db.songs.get(songId))) return;
        await writeSongToFolder(dir, songId, { includeAudio: prefs.audio });
        await writePending((await readPending()).filter((id) => id !== songId));
      })
      .catch((e: unknown) => console.warn('Não foi possível salvar na pasta', e));
    return chain;
  };

  return {
    /** Schedules a song to be written after `delayMs` of quiet. */
    request(songId: string | undefined) {
      if (!songId || isRestoring()) return Promise.resolve();
      clearTimeout(timers.get(songId));
      return new Promise<void>((done) => {
        timers.set(
          songId,
          setTimeout(() => {
            timers.delete(songId);
            void write(songId).then(done);
          }, delayMs),
        );
      });
    },
    /** Resolves when everything queued so far has been written. */
    idle: () => chain,
    pending: readPending,
    /** Writes the changes that could not be saved earlier (call after access was granted). */
    async flush() {
      for (const id of await readPending()) await write(id);
      await chain;
    },
    /** Before a song is deleted: its files go to the trash folder instead of coming back on the next restore. */
    async trash(songId: string, title: string) {
      const dir = await getDir();
      const w = (await writtenMap())[songId];
      if (!dir || !w || !(await folderAccess(dir, false))) return;
      const trash = await subdir(dir, FOLDERS.trash);
      const pack = await readFile(await existingDir(dir, FOLDERS.packages), `${w.base}.willmusic.zip`);
      if (pack) await writeFile(trash, `${w.base}.willmusic.zip`, pack);
      const cho = await readFile(await existingDir(dir, FOLDERS.charts, ...(w.folder ? [w.folder] : [])), `${w.base}.cho`);
      if (cho) await writeFile(trash, `${w.base}.cho`, cho);
      await removeSongFiles(dir, w);
      await saveWritten(songId, null);
      console.info(`"${title}" foi para a Lixeira da pasta.`);
    },
  };
};

export const folderSync = createFolderSync();

const DISPLAY_ONLY = new Set(['fontSize', 'transpose', 'updatedAt']);

/** Watches the database and keeps the connected folder up to date. */
let folderSyncStarted = false;
export const startFolderAutoSync = (): void => {
  if (folderSyncStarted) return;
  folderSyncStarted = true;
  const changed = (mods: object) => Object.keys(mods).some((k) => !DISPLAY_ONLY.has(k));
  db.charts.hook('creating', (_pk, obj) => void folderSync.request(obj.songId));
  db.charts.hook('updating', (mods, _pk, obj) => void (changed(mods) && folderSync.request(obj.songId)));
  db.scores.hook('creating', (_pk, obj) => void folderSync.request(obj.songId));
  db.scores.hook('updating', (_mods, _pk, obj) => void folderSync.request(obj.songId));
  db.songs.hook('updating', (mods, _pk, obj) => void (changed(mods) && folderSync.request(obj.id)));
  db.songs.hook('deleting', (_pk, obj) => void folderSync.trash(obj.id, obj.title).catch(() => undefined));
  // Changes made while access was not granted are written as soon as it is (e.g. the next visit that allows it).
  void folderSync.flush();
};
