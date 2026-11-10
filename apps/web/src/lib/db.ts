import type { ChordSegment, DrumHit, KeyResult, NoteEvent, StemMode, VoicePart } from '@will-music/engine';
import Dexie, { type EntityTable, type Table } from 'dexie';
import { isQuotaError, requestPersistence } from './storage.ts';
import { clearPendingAnalysis } from './pendingAnalysis.ts';

export type AnalysisStatus = 'pending' | 'running' | 'done' | 'error';

export type Song = {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  key?: string;
  tempo?: number;
  capo?: number;
  timeSignature?: string;
  /** User folder in the chart library (e.g. Culto, Natal, Ensaio). */
  folder?: string;
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
  lyrics?: { source: 'lrclib' | 'manual' | 'transcription'; lrclibId?: number; lines: LyricLine[]; warning?: string; chosenByUser?: boolean };
  warnings?: string[];
  processing?: { execution: 'parallel' | 'sequential'; chordsMs: number; lyricsMs: number; totalMs: number; transcriptionRetried?: boolean };
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
  /** Start time of each lyric line, in chart order (spec §5.5). null = interpolate. */
  lineTimes?: (number | null)[];
  createdAt: string;
  updatedAt: string;
};

export type AudioRecord = { songId: string; blob: Blob; mimeType: string };
type StoredAudioRecord = Omit<AudioRecord, 'blob'> & { blob: Blob | ArrayBuffer };

export type StemName = 'instrumental' | 'lead' | 'backing' | 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'other';
/** One separation of a song; a song may keep several (one per mode). The most recently selected one plays. */
export type StemsRecord = { songId: string; mode: StemMode; model: string; sampleRate: number; tracks: { name: StemName; blob: Blob }[]; createdAt: string; selectedAt: string };

/** Waveform peaks for the practice view (computed once per song). */
export type PeaksRecord = { songId: string; peaks: Float32Array; duration: number };

/** Transcribed melody (raw note times); the MusicXML is rebuilt from it on demand. */
export type ScoreRecord = {
  songId: string;
  notes: NoteEvent[];
  bpm: number;
  source: 'lead' | 'mix';
  model: string;
  createdAt: string;
  /** Polyphonic notes for the keyboard score, and where they came from. */
  piano?: { notes: NoteEvent[]; source: string };
  /** Drum hits for the drum score (from a separated drum track). */
  drums?: { hits: DrumHit[] };
  /** The sung notes split into soprano, alto, tenor and bass (choir score and voice guides). */
  choir?: { voices: Record<VoicePart, NoteEvent[]>; source: string };
};

export type SetlistItem = { songId: string; targetKey?: string; note?: string };
export type Setlist = { id: string; name: string; date?: string; items: SetlistItem[]; createdAt: string; updatedAt: string };

// Audio lives in IndexedDB as a Blob (works in every target browser, Safari included);
// swapping it for OPFS later only touches this file.
export const db = new Dexie('will-music') as Dexie & {
  songs: EntityTable<Song, 'id'>;
  audio: EntityTable<AudioRecord, 'songId'>;
  analyses: EntityTable<Analysis, 'id'>;
  charts: EntityTable<Chart, 'id'>;
  setlists: EntityTable<Setlist, 'id'>;
  stemSets: Table<StemsRecord, [string, StemMode]>;
  peaks: EntityTable<PeaksRecord, 'songId'>;
  settings: EntityTable<{ key: string; value: unknown }, 'key'>;
  scores: EntityTable<ScoreRecord, 'songId'>;
};

db.version(1).stores({
  songs: 'id, title, artist, updatedAt',
  audio: 'songId',
  analyses: 'id, songId',
  charts: 'id, songId',
});

db.version(2).stores({ setlists: 'id, updatedAt' });
db.version(3).stores({ stems: 'songId' });
db.version(4).stores({ scores: 'songId' });
// v5: several separations per song. The old single 'stems' rows become the 'vocals' mode; v6 drops the old table.
db.version(5)
  .stores({ stemSets: '[songId+mode], songId', peaks: 'songId' })
  .upgrade(async (tx) => {
    const old = (await tx.table('stems').toArray()) as Omit<StemsRecord, 'mode' | 'selectedAt'>[];
    await tx.table('stemSets').bulkPut(old.map((r) => ({ ...r, mode: 'vocals', selectedAt: r.createdAt })));
  });
db.version(6).stores({ stems: null });
// v7: app settings that must survive (e.g. the connected device folder handle).
db.version(7).stores({ settings: 'key' });

// Public readers always receive a Blob, including the binary fallback used for refused Blob writes.
// No schema upgrade is needed: only the non-indexed audio payload changes representation.
const isBinaryAudio = (value: Blob | ArrayBuffer): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === '[object ArrayBuffer]';
db.audio.hook('reading', (record: StoredAudioRecord | undefined) =>
  record && isBinaryAudio(record.blob)
    ? { ...record, blob: new Blob([record.blob], { type: record.mimeType }) }
    : record,
);

// A binary retry needs a full memory copy. Keep it bounded for large WAVs and mobile devices.
const MAX_BINARY_RETRY_BYTES = 64 * 1024 * 1024;

export type AudioImportAttempt = { format: 'blob' | 'binary'; stage: 'song' | 'audio' | 'commit'; error: string };
const importFailures = new WeakMap<object, AudioImportAttempt[]>();
export const getAudioImportAttempts = (error: unknown): AudioImportAttempt[] =>
  error && typeof error === 'object' ? importFailures.get(error) ?? [] : [];

export const now = (): string => new Date().toISOString();

export const createSong = async (input: { title: string; artist: string; durationSec: number }, audio: Blob): Promise<Song> => {
  // First saved song: ask the browser to keep this site's data (spec §5.4).
  if ((await db.songs.count()) === 0) await requestPersistence();
  const stamp = now();
  const song: Song = { id: crypto.randomUUID(), ...input, favorite: false, analysisStatus: 'pending', createdAt: stamp, updatedAt: stamp };
  const attempts: AudioImportAttempt[] = [];
  const save = async (blob: Blob | ArrayBuffer) => {
    let stage: AudioImportAttempt['stage'] = 'song';
    try {
      await db.transaction('rw', db.songs, db.audio, async () => {
        await db.songs.add(song);
        stage = 'audio';
        await db.table<StoredAudioRecord, string>('audio').put({ songId: song.id, blob, mimeType: audio.type });
        stage = 'commit';
      });
    } catch (error) {
      attempts.push({ format: isBinaryAudio(blob) ? 'binary' : 'blob', stage, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
      if (error && typeof error === 'object') importFailures.set(error, [...attempts]);
      throw error;
    }
  };
  try {
    await save(audio);
  } catch (error) {
    if (!isQuotaError(error) || audio.size > MAX_BINARY_RETRY_BYTES) throw error;
    // Retry only after the failed transaction rolled back, with the same id and exact file bytes.
    // This can recover a Blob-storage refusal; it cannot bypass an exhausted origin/device quota.
    const bytes = await audio.arrayBuffer();
    await save(bytes);
  }
  return song;
};

export const updateSong = async (id: string, patch: Partial<Omit<Song, 'id' | 'createdAt'>>): Promise<void> => {
  await db.songs.update(id, { ...patch, updatedAt: now() });
};

export const deleteSong = async (id: string): Promise<void> => {
  await db.transaction('rw', [db.songs, db.audio, db.analyses, db.charts, db.stemSets, db.scores, db.peaks], async () => {
    await db.songs.delete(id);
    await db.scores.delete(id);
    await db.audio.delete(id);
    await db.stemSets.where('songId').equals(id).delete();
    await db.peaks.delete(id);
    await db.analyses.where('songId').equals(id).delete();
    await db.charts.where('songId').equals(id).delete();
  });
  clearPendingAnalysis(id);
};

export const listSongs = (): Promise<Song[]> => db.songs.orderBy('updatedAt').reverse().toArray();
