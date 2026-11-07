import { db } from './db.ts';
import { encodeMp3 } from './exportMix.ts';

export type SongStorage = { id: string; title: string; artist: string; audio: number; audioType?: string; stems: number; stemSets: number; total: number };

/** How much each song takes on the device: original audio, separated tracks and the rest (charts are tiny). */
export const songStorage = async (): Promise<SongStorage[]> => {
  const [songs, audio, sets] = await Promise.all([db.songs.toArray(), db.audio.toArray(), db.stemSets.toArray()]);
  const audioBy = new Map(audio.map((a) => [a.songId, a]));
  return songs
    .map((s) => {
      const a = audioBy.get(s.id);
      const own = sets.filter((x) => x.songId === s.id);
      const stems = own.reduce((n, x) => n + x.tracks.reduce((m, t) => m + t.blob.size, 0), 0);
      const audioBytes = a?.blob.size ?? 0;
      return { id: s.id, title: s.title, artist: s.artist, audio: audioBytes, audioType: a?.mimeType, stems, stemSets: own.length, total: audioBytes + stems };
    })
    .sort((a, z) => z.total - a.total);
};

/** Frees the heavy data of a song but keeps what matters for playing it: chart, analysis, scores and lists. */
export const keepOnlyChart = async (songId: string): Promise<void> => {
  await db.transaction('rw', [db.audio, db.stemSets, db.peaks], async () => {
    await db.audio.delete(songId);
    await db.stemSets.where('songId').equals(songId).delete();
    await db.peaks.delete(songId);
  });
};

export const deleteAllStems = (songId: string): Promise<number> => db.stemSets.where('songId').equals(songId).delete();

/**
 * Re-encodes the original audio as a 128 kbps MP3 and keeps it only when that is clearly smaller
 * (WAV and high-bitrate files shrink a lot; an already small MP3 is left alone). Returns the bytes saved.
 */
export const compactAudio = async (songId: string): Promise<number> => {
  const audio = await db.audio.get(songId);
  if (!audio) return 0;
  const context = new OfflineAudioContext(2, 1, 44100);
  const buffer = await context.decodeAudioData(await audio.blob.arrayBuffer());
  const left = buffer.getChannelData(0).slice();
  const right = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice();
  const mp3 = await encodeMp3(left, right, 44100, 128);
  if (mp3.size > audio.blob.size * 0.85) return 0;
  await db.audio.put({ songId, blob: mp3, mimeType: 'audio/mpeg' });
  return audio.blob.size - mp3.size;
};
