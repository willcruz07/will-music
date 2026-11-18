import type { Analysis, LyricLine } from './db.ts';
import { alignLyricsToWords, type TimedWord } from './lyricsAlign.ts';
import type { findSongLyrics } from './lrclib.ts';

type Found = Awaited<ReturnType<typeof findSongLyrics>>;
type Heard = { lines: LyricLine[]; words?: TimedWord[] };

/**
 * Picks the lyrics for the chart from LRCLIB's text and what Whisper heard: LRCLIB placed on Whisper's word times
 * when they agree, LRCLIB's own times when they disagree, otherwise the transcription.
 */
export const chooseLyrics = (found: Found, heard: Heard | null, durationSec: number): { lyrics: NonNullable<Analysis['lyrics']>; label: string } | null => {
  const aligned = found && heard?.words ? alignLyricsToWords(found.lines, heard.words, durationSec) : null;
  if (found && aligned && aligned.coverage >= 0.5) return { lyrics: { source: 'lrclib', lrclibId: found.lrclibId, lines: aligned.lines }, label: 'Letra encontrada e sincronizada' };
  if (found && (!heard || !found.warning)) return { lyrics: found, label: 'Letra encontrada' };
  if (heard) return { lyrics: { source: 'transcription', lines: heard.lines }, label: 'Letra transcrita' };
  return null;
};
