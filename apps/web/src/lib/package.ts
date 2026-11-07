import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { type Analysis, type Chart, type Setlist, type Song, db, deleteSong, now } from './db.ts';

export const PACKAGE_VERSION = 1;
const NOT_A_PACKAGE = 'Este arquivo não é um pacote do will-music.';

type Kind = 'song' | 'setlist' | 'backup';
type Manifest = { format: 'will-music'; version: number; kind: Kind; createdAt: string; songIds: string[] };

export type PackagedSong = {
  song: Song;
  chart?: Omit<Chart, 'chordPro'> & { chordPro: string };
  analysis?: Analysis;
  audio?: { bytes: Uint8Array; mimeType: string };
};
export type PackageContents = { manifest: Manifest; songs: PackagedSong[]; setlist?: Setlist };

const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' };

export const safeFileName = (title: string): string =>
  title.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '') || 'will-music';

const json = (value: unknown) => strToU8(JSON.stringify(value, null, 2));

/** Builds a .willmusic.zip with manifest, song.json, chart.cho + chart.json, analysis.json and (optionally) the audio. */
export const exportSongs = async (songIds: string[], opts: { includeAudio: boolean; kind: Kind; setlist?: Setlist }): Promise<Blob> => {
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
  if (opts.setlist) files['setlist.json'] = json(opts.setlist);
  const manifest: Manifest = { format: 'will-music', version: PACKAGE_VERSION, kind: opts.kind, createdAt: now(), songIds: ids };
  files['manifest.json'] = json(manifest);
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
};

export const readPackage = async (file: Blob): Promise<PackageContents> => {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(NOT_A_PACKAGE);
  }
  const parse = <T,>(path: string): T | undefined => (entries[path] ? (JSON.parse(strFromU8(entries[path]!)) as T) : undefined);
  let manifest: Manifest | undefined;
  try {
    manifest = parse<Manifest>('manifest.json');
  } catch {
    throw new Error(NOT_A_PACKAGE);
  }
  if (!manifest || manifest.format !== 'will-music') throw new Error(NOT_A_PACKAGE);
  if (manifest.version > PACKAGE_VERSION) throw new Error('Pacote de uma versão mais nova do will-music. Atualize o app.');
  const songs: PackagedSong[] = [];
  for (const id of manifest.songIds) {
    const base = `songs/${id}/`;
    const song = parse<Song>(`${base}song.json`);
    if (!song) continue;
    const chartMeta = parse<Omit<Chart, 'chordPro'>>(`${base}chart.json`);
    const cho = entries[`${base}chart.cho`];
    const audioMeta = parse<{ mimeType: string }>(`${base}audio.json`);
    const audioPath = Object.keys(entries).find((p) => p.startsWith(`${base}audio.`) && !p.endsWith('.json'));
    songs.push({
      song,
      chart: chartMeta && cho ? { ...chartMeta, chordPro: strFromU8(cho) } : undefined,
      analysis: parse<Analysis>(`${base}analysis.json`),
      audio: audioPath && audioMeta ? { bytes: entries[audioPath]!, mimeType: audioMeta.mimeType } : undefined,
    });
  }
  return { manifest, songs, setlist: parse<Setlist>('setlist.json') };
};

/**
 * Writes the package into the local database. For songs that already exist, `resolve` decides:
 * "replace" swaps everything (chart, analysis, audio); "keep-both" stores copies with new ids.
 * A packaged setlist is always added as a new list pointing at the imported songs.
 */
export const importPackage = async (
  contents: PackageContents,
  resolve: (existing: Song) => Promise<'replace' | 'keep-both'>,
): Promise<{ songs: number; setlist?: Setlist }> => {
  const idMap = new Map<string, string>();
  for (const entry of contents.songs) {
    const existing = await db.songs.get(entry.song.id);
    let id = entry.song.id;
    if (existing) {
      if ((await resolve(existing)) === 'replace') await deleteSong(existing.id);
      else id = crypto.randomUUID();
    }
    idMap.set(entry.song.id, id);
    const stamp = now();
    await db.transaction('rw', [db.songs, db.charts, db.analyses, db.audio], async () => {
      await db.songs.put({ ...entry.song, id, analysisStatus: entry.song.analysisStatus === 'running' ? 'pending' : entry.song.analysisStatus, updatedAt: stamp });
      if (entry.chart) await db.charts.put({ ...entry.chart, id: id === entry.song.id ? entry.chart.id : crypto.randomUUID(), songId: id });
      if (entry.analysis) await db.analyses.put({ ...entry.analysis, id: id === entry.song.id ? entry.analysis.id : crypto.randomUUID(), songId: id });
      if (entry.audio) await db.audio.put({ songId: id, blob: new Blob([entry.audio.bytes as Uint8Array<ArrayBuffer>], { type: entry.audio.mimeType }), mimeType: entry.audio.mimeType });
    });
  }
  let setlist: Setlist | undefined;
  if (contents.setlist) {
    const stamp = now();
    setlist = {
      ...contents.setlist,
      id: crypto.randomUUID(),
      items: contents.setlist.items.map((item) => ({ ...item, songId: idMap.get(item.songId) ?? item.songId })),
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.setlists.add(setlist);
  }
  return { songs: contents.songs.length, setlist };
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
