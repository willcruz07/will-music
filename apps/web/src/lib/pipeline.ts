import { analyzeInWorker } from '../worker/client.ts';
import { buildChart, keyToChord } from './chart.ts';
import { type Analysis, type Chart, type LyricLine, db, now, updateSong } from './db.ts';
import { decodeForAnalysis } from './decode.ts';
import { distributePlainLyrics, parseLrc, pickBestLyrics, searchLyrics } from './lrclib.ts';
import { applyLyrics, lyricsToKeep } from './lyricsApply.ts';
import { transcribeSong } from './whisper.ts';
import { describeTranscription } from './transcript.ts';

/**
 * `lyricsPending`: the chart with the chords is saved and only the lyrics are still being transcribed, so the song
 * page can show the chords already. `detail`: the latest words heard, so a slow transcription does not look stuck.
 */
export type PipelineProgress = { label: string; fraction?: number; detail?: string; lyricsPending?: boolean };

const mb = (bytes: number) => (bytes / 1e6).toFixed(0);

export const runPipeline = async (songId: string, onProgress: (p: PipelineProgress) => void): Promise<void> => {
  const song = await db.songs.get(songId);
  const audio = await db.audio.get(songId);
  if (!song || !audio) throw new Error('Música não encontrada.');
  await updateSong(songId, { analysisStatus: 'running', analysisError: undefined });
  try {
    onProgress({ label: 'Preparando o áudio' });
    const { channels, durationSec } = await decodeForAnalysis(audio.blob);

    const result = await analyzeInWorker(channels, (e) => {
      if (e.stage === 'models') onProgress({ label: `Baixando os modelos (${mb(e.done)} MB de ${mb(e.total)} MB)`, fraction: e.done / e.total });
      else if (e.stage === 'chords') onProgress({ label: `Detectando os acordes (${e.done} de ${e.total})`, fraction: e.done / e.total });
      else onProgress({ label: 'Detectando o tom' });
    });

    const previous = await db.analyses.where('songId').equals(songId).first();
    let lyrics = lyricsToKeep(previous?.lyrics);
    if (!lyrics) {
      onProgress({ label: 'Buscando a letra' });
      const picked = pickBestLyrics(await searchLyrics(song.title, song.artist), durationSec, song.artist);
      if (picked) {
        const lines: LyricLine[] = picked.result.syncedLyrics
          ? parseLrc(picked.result.syncedLyrics)
          : distributePlainLyrics(picked.result.plainLyrics ?? '', durationSec);
        lyrics = { source: 'lrclib', lrclibId: picked.result.id, lines, warning: picked.warning };
      }
    }
    const lines = lyrics?.lines ?? [];

    const stamp = now();
    const analysis: Analysis = {
      id: crypto.randomUUID(),
      songId,
      schemaVersion: 1,
      models: result.models,
      key: result.key,
      chords: result.chords,
      lyrics,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const chordPro = buildChart({ title: song.title, artist: song.artist, key: result.key, chords: result.chords, lines });

    await db.transaction('rw', [db.analyses, db.charts, db.songs], async () => {
      await db.analyses.where('songId').equals(songId).delete();
      await db.analyses.add(analysis);
      const existing = await db.charts.where('songId').equals(songId).first();
      if (!existing) {
        const chart: Chart = { id: crypto.randomUUID(), songId, chordPro, lineTimes: lines.map((l) => l.start), transpose: 0, fontSize: 18, origin: 'generated', generatedFromAnalysisId: analysis.id, createdAt: stamp, updatedAt: stamp };
        await db.charts.add(chart);
      } else if (existing.origin === 'generated') {
        await db.charts.update(existing.id, { chordPro, lineTimes: lines.map((l) => l.start), generatedFromAnalysisId: analysis.id, updatedAt: stamp });
      }
      await updateSong(songId, { key: keyToChord(result.key), durationSec: song.durationSec || durationSec, analysisStatus: 'done' });
    });

    // An audio never stays without lyrics: when the search finds nothing, Whisper listens and writes them.
    // The chart is already saved; if the transcription fails (an instrumental, say), the song keeps its chords.
    if (!lines.length) {
      onProgress({ label: 'Preparando a transcrição da letra', lyricsPending: true });
      try {
        const { lines: heard } = await transcribeSong(songId, (p) => onProgress({ ...describeTranscription(p), lyricsPending: true }));
        await applyLyrics(songId, { source: 'manual', lines: heard });
      } catch (error) {
        console.warn('Transcrição automática da letra não deu certo', error);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSong(songId, { analysisStatus: 'error', analysisError: message });
    throw error;
  }
};
