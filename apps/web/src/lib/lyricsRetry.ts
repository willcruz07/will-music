import { buildChart } from './chart.ts';
import { db } from './db.ts';
import { applyLyrics, type LyricsChoice } from './lyricsApply.ts';
import { chooseLyrics } from './lyricsChoice.ts';
import { findSongLyrics } from './lrclib.ts';
import { getPendingAnalysis } from './pendingAnalysis.ts';
import { isMobileStudio } from './studioDevice.ts';
import { describeTranscription } from './transcript.ts';
import { transcribeSong } from './whisper.ts';

export type LyricsRetryStatus = { label: string; fraction?: number; detail?: string };

/** Puts the lyrics in the studio's result: the unsaved one of this session, or the saved analysis. */
const applyStudioLyrics = async (songId: string, lyrics: LyricsChoice) => {
  const pending = getPendingAnalysis(songId);
  if (!pending) { await applyLyrics(songId, lyrics, { chosenByUser: false }); return; }
  pending.analysis = { ...pending.analysis, lyrics };
  if (pending.chart.origin === 'generated') {
    const { song, analysis } = pending;
    pending.chart = {
      ...pending.chart,
      chordPro: buildChart({ title: song.title, artist: song.artist, key: analysis.key, chords: analysis.chords, lines: lyrics.lines }),
      lineTimes: lyrics.lines.map((line) => line.start),
    };
  }
};

/**
 * Loads the lyrics of a song again, on their own (after a cancelled or failed step): LRCLIB's text, placed on what
 * Whisper hears on the computer; LRCLIB only on phones. Returns the result label, or null when nothing was found.
 */
export const loadLyricsAgain = async (songId: string, onStatus: (s: LyricsRetryStatus) => void, signal: AbortSignal): Promise<string | null> => {
  const song = await db.songs.get(songId);
  if (!song) throw new Error('Música não encontrada.');
  onStatus({ label: 'Buscando a letra…' });
  const lrclib = findSongLyrics(song.title, song.artist, song.durationSec).catch(() => null);
  const heard = isMobileStudio() ? null : await transcribeSong(songId, (p) => onStatus(describeTranscription(p)), { signal }).catch((error: unknown) => {
    if (signal.aborted) throw error;
    return null;
  });
  signal.throwIfAborted();
  const chosen = chooseLyrics(await lrclib, heard, song.durationSec);
  signal.throwIfAborted();
  if (!chosen) return null;
  await applyStudioLyrics(songId, chosen.lyrics);
  return chosen.label;
};
