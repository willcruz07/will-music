import { buildChart } from './chart.ts';
import { type Analysis, db, now } from './db.ts';

export type LyricsChoice = NonNullable<Analysis['lyrics']>;

/** Saves the chosen lyrics; rebuilds the chart unless the user has edited it. */
export const applyLyrics = async (songId: string, lyrics: LyricsChoice): Promise<'rebuilt' | 'kept-edited' | 'no-analysis'> => {
  return db.transaction('rw', [db.songs, db.analyses, db.charts], async () => {
    const [song, analysis, chart] = await Promise.all([
      db.songs.get(songId),
      db.analyses.where('songId').equals(songId).first(),
      db.charts.where('songId').equals(songId).first(),
    ]);
    if (!song || !analysis) return 'no-analysis';
    const stamp = now();
    await db.analyses.update(analysis.id, { lyrics, updatedAt: stamp });
    if (chart && chart.origin !== 'generated') return 'kept-edited';
    const chordPro = buildChart({ title: song.title, artist: song.artist, key: analysis.key, chords: analysis.chords, lines: lyrics.lines });
    if (chart) await db.charts.update(chart.id, { chordPro, generatedFromAnalysisId: analysis.id, updatedAt: stamp });
    else await db.charts.add({ id: crypto.randomUUID(), songId, chordPro, transpose: 0, fontSize: 18, origin: 'generated', generatedFromAnalysisId: analysis.id, createdAt: stamp, updatedAt: stamp });
    return 'rebuilt';
  });
};
