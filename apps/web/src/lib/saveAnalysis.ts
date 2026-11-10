import { db, now } from './db.ts';
import { clearPendingAnalysis, getPendingAnalysis } from './pendingAnalysis.ts';
import { lyricsToKeep } from './lyricsApply.ts';
import { buildChart } from './chart.ts';

/** Retries only the final transaction: no model, separation or transcription is executed. */
export const savePendingAnalysis = async (songId: string): Promise<void> => {
  const pending = getPendingAnalysis(songId);
  if (!pending) return;
  try {
    await db.transaction('rw', [db.analyses, db.charts, db.songs], async () => {
      const song = await db.songs.get(songId);
      if (!song) throw new Error('Esta música foi removida da biblioteca.');
      const current = await db.analyses.where('songId').equals(songId).first();
      const protectedLyrics = lyricsToKeep(current?.lyrics);
      const analysis = protectedLyrics ? { ...pending.analysis, lyrics: protectedLyrics } : pending.analysis;
      const existing = await db.charts.where('songId').equals(songId).first();
      let chart = { ...pending.chart, id: existing?.id ?? pending.chart.id, createdAt: existing?.createdAt ?? pending.chart.createdAt };
      if (existing && existing.origin !== 'generated') chart = existing;
      else if (protectedLyrics) chart = { ...chart, chordPro: buildChart({ title: song.title, artist: song.artist, key: analysis.key, chords: analysis.chords, lines: protectedLyrics.lines }), lineTimes: protectedLyrics.lines.map((line) => line.start) };
      await db.analyses.where('songId').equals(songId).delete();
      await db.analyses.add(analysis);
      await db.charts.put(chart);
      await db.songs.update(songId, { key: pending.song.key, durationSec: song.durationSec || pending.song.durationSec, analysisStatus: 'done', analysisError: undefined, updatedAt: now() });
    });
    if (getPendingAnalysis(songId) === pending) clearPendingAnalysis(songId);
  } catch (error) {
    pending.error = error;
    throw error;
  }
};
