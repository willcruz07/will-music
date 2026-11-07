import { buildChart } from './chart.ts';
import { type Song, db, now } from './db.ts';
import { remapLineTimes } from './lineTimes.ts';

export const saveEditedChart = async (songId: string, chordPro: string): Promise<void> => {
  const chart = await db.charts.where('songId').equals(songId).first();
  const stamp = now();
  if (!chart) {
    await db.charts.add({ id: crypto.randomUUID(), songId, chordPro, transpose: 0, fontSize: 18, origin: 'edited', createdAt: stamp, updatedAt: stamp });
    return;
  }
  const lineTimes = remapLineTimes(chart.chordPro, chordPro, chart.lineTimes ?? []);
  await db.charts.update(chart.id, { chordPro, lineTimes, origin: 'edited', updatedAt: stamp });
};

/** Rebuilds the chart from the current analysis and marks it generated again. */
export const restoreGeneratedChart = async (songId: string): Promise<boolean> => {
  const [song, analysis, chart] = await Promise.all([
    db.songs.get(songId),
    db.analyses.where('songId').equals(songId).first(),
    db.charts.where('songId').equals(songId).first(),
  ]);
  if (!song || !analysis || !chart) return false;
  const lines = analysis.lyrics?.lines ?? [];
  const chordPro = buildChart({ title: song.title, artist: song.artist, key: analysis.key, chords: analysis.chords, lines });
  await db.charts.update(chart.id, { chordPro, lineTimes: lines.map((l) => l.start), origin: 'generated', generatedFromAnalysisId: analysis.id, updatedAt: now() });
  return true;
};

export const createManualSong = async (title: string, artist: string): Promise<Song> => {
  const stamp = now();
  const song: Song = { id: crypto.randomUUID(), title, artist, durationSec: 0, favorite: false, analysisStatus: 'done', createdAt: stamp, updatedAt: stamp };
  const header = [`{title: ${title}}`, ...(artist ? [`{artist: ${artist}}`] : []), ''].join('\n');
  await db.transaction('rw', db.songs, db.charts, async () => {
    await db.songs.add(song);
    await db.charts.add({ id: crypto.randomUUID(), songId: song.id, chordPro: `${header}\n`, transpose: 0, fontSize: 18, origin: 'manual', createdAt: stamp, updatedAt: stamp });
  });
  return song;
};
