import type { ChordSegment, KeyResult } from '@will-music/engine';
import Dexie, { type EntityTable } from 'dexie';

export type AnalysisStatus = 'pending' | 'running' | 'done' | 'error';

export type Song = {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  key?: string;
  tempo?: number;
  capo?: number;
  favorite: boolean;
  analysisStatus: AnalysisStatus;
  analysisError?: string;
  createdAt: string;
  updatedAt: string;
};

export type LyricLine = { start: number; text: string };

export type Analysis = {
  id: string;
  songId: string;
  schemaVersion: 1;
  models: Record<string, string>;
  key: KeyResult;
  chords: ChordSegment[];
  lyrics?: { source: 'lrclib' | 'manual'; lrclibId?: number; lines: LyricLine[]; warning?: string };
  createdAt: string;
  updatedAt: string;
};

export type Chart = {
  id: string;
  songId: string;
  chordPro: string;
  transpose: number;
  fontSize: number;
  origin: 'generated' | 'edited' | 'manual';
  generatedFromAnalysisId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AudioRecord = { songId: string; blob: Blob; mimeType: string };

// Audio lives in IndexedDB as a Blob (works in every target browser, Safari included);
// swapping it for OPFS later only touches this file.
export const db = new Dexie('will-music') as Dexie & {
  songs: EntityTable<Song, 'id'>;
  audio: EntityTable<AudioRecord, 'songId'>;
  analyses: EntityTable<Analysis, 'id'>;
  charts: EntityTable<Chart, 'id'>;
};

db.version(1).stores({
  songs: 'id, title, artist, updatedAt',
  audio: 'songId',
  analyses: 'id, songId',
  charts: 'id, songId',
});

export const now = (): string => new Date().toISOString();

export const createSong = async (input: { title: string; artist: string; durationSec: number }, audio: Blob): Promise<Song> => {
  const stamp = now();
  const song: Song = { id: crypto.randomUUID(), ...input, favorite: false, analysisStatus: 'pending', createdAt: stamp, updatedAt: stamp };
  await db.transaction('rw', db.songs, db.audio, async () => {
    await db.songs.add(song);
    await db.audio.put({ songId: song.id, blob: audio, mimeType: audio.type });
  });
  return song;
};

export const updateSong = async (id: string, patch: Partial<Omit<Song, 'id' | 'createdAt'>>): Promise<void> => {
  await db.songs.update(id, { ...patch, updatedAt: now() });
};

export const deleteSong = async (id: string): Promise<void> => {
  await db.transaction('rw', [db.songs, db.audio, db.analyses, db.charts], async () => {
    await db.songs.delete(id);
    await db.audio.delete(id);
    await db.analyses.where('songId').equals(id).delete();
    await db.charts.where('songId').equals(id).delete();
  });
};

export const listSongs = (): Promise<Song[]> => db.songs.orderBy('updatedAt').reverse().toArray();
