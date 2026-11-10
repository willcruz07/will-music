import { db, now, type Song, type Chart } from './db.ts';

/** An independent library chart: no audio, analysis or stem references are copied. */
export const saveStudioChart = async (source: Song, chart: Chart): Promise<Song> => {
  const stamp = now();
  const song: Song = {
    id: crypto.randomUUID(), title: source.title, artist: source.artist,
    key: source.key, capo: source.capo, tempo: source.tempo, timeSignature: source.timeSignature,
    durationSec: 0, favorite: false, analysisStatus: 'done', createdAt: stamp, updatedAt: stamp,
  };
  await db.transaction('rw', db.songs, db.charts, async () => {
    await db.songs.add(song);
    await db.charts.add({ id: crypto.randomUUID(), songId: song.id, chordPro: chart.chordPro,
      transpose: chart.transpose, fontSize: chart.fontSize, chordShapes: chart.chordShapes, chordInstrument: chart.chordInstrument, origin: 'manual', createdAt: stamp, updatedAt: stamp });
  });
  return song;
};
