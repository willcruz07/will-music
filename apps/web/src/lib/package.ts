import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { type Analysis, type Chart, type Setlist, type Song, db, now } from './db.ts';

export const PACKAGE_VERSION = 1;
const NOT_A_PACKAGE = 'Este arquivo não é um pacote do will-music.';

type Kind = 'song' | 'setlist' | 'backup';
type Manifest = { format: 'will-music'; version: number; kind: Kind; createdAt: string; songIds: string[] };

export type PackagedSong = {
  song: Song;
  chart?: Chart;
  analysis?: Analysis;
  audio?: { bytes: Uint8Array; mimeType: string };
};
export type PackageContents = { manifest: Manifest; songs: PackagedSong[]; setlists: Setlist[] };

const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' };

export const safeFileName = (title: string): string =>
  title.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '') || 'will-music';

const json = (value: unknown) => strToU8(JSON.stringify(value, null, 2));

/** Builds a .willmusic.zip: manifest, per song song.json / chart.cho + chart.json / analysis.json / audio, and setlists.json. */
export const exportSongs = async (
  songIds: string[],
  opts: { includeAudio: boolean; kind: Kind; setlist?: Setlist; setlists?: Setlist[] },
): Promise<Blob> => {
  const files: Record<string, Uint8Array> = {};
  const ids: string[] = [];
  for (const id of songIds) {
    if (ids.includes(id)) continue;
    const song = await db.songs.get(id);
    if (!song) continue;
    ids.push(id);
    const base = `songs/${id}/`;
    files[`${base}song.json`] = json(song);
    const chart = await db.charts.where('songId').equals(id).first();
    if (chart) {
      const { chordPro, ...rest } = chart;
      files[`${base}chart.cho`] = strToU8(chordPro);
      files[`${base}chart.json`] = json(rest);
    }
    const analysis = await db.analyses.where('songId').equals(id).first();
    if (analysis) files[`${base}analysis.json`] = json(analysis);
    if (opts.includeAudio) {
      const audio = await db.audio.get(id);
      if (audio) {
        files[`${base}audio.${EXT[audio.mimeType] ?? 'bin'}`] = new Uint8Array(await audio.blob.arrayBuffer());
        files[`${base}audio.json`] = json({ mimeType: audio.mimeType });
      }
    }
  }
  const setlists = opts.setlists ?? (opts.setlist ? [opts.setlist] : []);
  if (setlists.length) files['setlists.json'] = json(setlists);
  const manifest: Manifest = { format: 'will-music', version: PACKAGE_VERSION, kind: opts.kind, createdAt: now(), songIds: ids };
  files['manifest.json'] = json(manifest);
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
};

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isSong = (v: unknown): v is Song => !!v && typeof v === 'object' && isString((v as Song).id) && typeof (v as Song).title === 'string';
const isSetlist = (v: unknown): v is Setlist =>
  !!v && typeof v === 'object' && typeof (v as Setlist).name === 'string' && Array.isArray((v as Setlist).items) && (v as Setlist).items.every((i) => isString(i?.songId));

/** Reads and validates the whole package before anything is written; any malformed part rejects it. */
export const readPackage = async (file: Blob): Promise<PackageContents> => {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(NOT_A_PACKAGE);
  }
  const parse = <T,>(path: string): T | undefined => {
    const bytes = entries[path];
    if (!bytes) return undefined;
    try {
      return JSON.parse(strFromU8(bytes)) as T;
    } catch {
      throw new Error(NOT_A_PACKAGE);
    }
  };
  const manifest = parse<Manifest>('manifest.json');
  if (!manifest || manifest.format !== 'will-music' || typeof manifest.version !== 'number') throw new Error(NOT_A_PACKAGE);
  // A newer format may be laid out differently: report the version before judging the layout.
  if (manifest.version > PACKAGE_VERSION) throw new Error('Pacote de uma versão mais nova do will-music. Atualize o app.');
  if (!Array.isArray(manifest.songIds) || !manifest.songIds.every(isString)) throw new Error(NOT_A_PACKAGE);

  const songs: PackagedSong[] = [];
  for (const id of manifest.songIds) {
    const base = `songs/${id}/`;
    const song = parse<Song>(`${base}song.json`);
    if (!isSong(song)) throw new Error(NOT_A_PACKAGE);
    const chartMeta = parse<Omit<Chart, 'chordPro'>>(`${base}chart.json`);
    const cho = entries[`${base}chart.cho`];
    const audioMeta = parse<{ mimeType: string }>(`${base}audio.json`);
    const audioPath = Object.keys(entries).find((p) => p.startsWith(`${base}audio.`) && !p.endsWith('.json'));
    songs.push({
      song,
      chart: chartMeta && cho ? ({ ...chartMeta, chordPro: strFromU8(cho) } as Chart) : undefined,
      analysis: parse<Analysis>(`${base}analysis.json`),
      audio: audioPath && audioMeta ? { bytes: entries[audioPath]!, mimeType: audioMeta.mimeType } : undefined,
    });
  }
  const list = parse<Setlist[]>('setlists.json') ?? (parse<Setlist>('setlist.json') ? [parse<Setlist>('setlist.json')!] : []);
  if (!Array.isArray(list) || !list.every(isSetlist)) throw new Error(NOT_A_PACKAGE);
  return { manifest, songs, setlists: list };
};

/**
 * Writes the package in one transaction (all or nothing). When songs already exist, `resolve` is
 * asked once with all of them: "replace" swaps everything; "keep-both" stores copies with new ids.
 * Packaged setlists are added as new lists pointing at the imported songs.
 */
export const importPackage = async (
  contents: PackageContents,
  resolve: (conflicts: Song[]) => Promise<'replace' | 'keep-both'>,
): Promise<{ songs: number; setlists: Setlist[]; setlist?: Setlist }> => {
  const conflicts = (await Promise.all(contents.songs.map((e) => db.songs.get(e.song.id)))).filter((s): s is Song => !!s);
  const decision = conflicts.length ? await resolve(conflicts) : 'replace';
  const conflictIds = new Set(conflicts.map((s) => s.id));
  const idMap = new Map<string, string>();
  const stamp = now();
  const setlists: Setlist[] = [];

  await db.transaction('rw', [db.songs, db.charts, db.analyses, db.audio, db.setlists], async () => {
    for (const entry of contents.songs) {
      const original = entry.song.id;
      const copy = conflictIds.has(original) && decision === 'keep-both';
      const id = copy ? crypto.randomUUID() : original;
      idMap.set(original, id);
      if (conflictIds.has(original) && !copy) {
        await db.songs.delete(original);
        await db.audio.delete(original);
        await db.analyses.where('songId').equals(original).delete();
        await db.charts.where('songId').equals(original).delete();
      }
      await db.songs.put({ ...entry.song, id, analysisStatus: entry.song.analysisStatus === 'running' ? 'pending' : entry.song.analysisStatus, updatedAt: stamp });
      if (entry.chart) await db.charts.put({ ...entry.chart, id: copy ? crypto.randomUUID() : entry.chart.id, songId: id });
      if (entry.analysis) await db.analyses.put({ ...entry.analysis, id: copy ? crypto.randomUUID() : entry.analysis.id, songId: id });
      if (entry.audio) {
        await db.audio.put({ songId: id, blob: new Blob([entry.audio.bytes as Uint8Array<ArrayBuffer>], { type: entry.audio.mimeType }), mimeType: entry.audio.mimeType });
      }
    }
    for (const list of contents.setlists) {
      const imported: Setlist = {
        ...list,
        id: crypto.randomUUID(),
        items: list.items.map((item) => ({ ...item, songId: idMap.get(item.songId) ?? item.songId })),
        createdAt: stamp,
        updatedAt: stamp,
      };
      await db.setlists.add(imported);
      setlists.push(imported);
    }
  });
  return { songs: contents.songs.length, setlists, setlist: setlists[0] };
};

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
