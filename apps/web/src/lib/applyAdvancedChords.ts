import type { ChordSegment } from '@will-music/engine';
import { buildChart } from './chart.ts';
import { db, now } from './db.ts';

/** Replace only the selected interval; retain the original timing/chords outside it. */
export const mergeAdvancedChords = (original: readonly ChordSegment[], advanced: readonly ChordSegment[], start: number, end: number): ChordSegment[] => {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error('Trecho inválido.');
  const retained = original.flatMap((chord) => {
    if (chord.end <= start || chord.start >= end) return [{ ...chord }];
    return [...(chord.start < start ? [{ ...chord, end: start }] : []), ...(chord.end > end ? [{ ...chord, start: end }] : [])];
  });
  const replacement = advanced.map((chord) => ({ ...chord, start: Math.max(start, chord.start), end: Math.min(end, chord.end) }))
    .filter((chord) => Number.isFinite(chord.start) && Number.isFinite(chord.end) && chord.end > chord.start);
  if (!replacement.some((chord) => chord.raw !== 'N' && chord.raw !== 'X')) throw new Error('A análise não encontrou acordes para aplicar neste trecho.');
  return [...retained, ...replacement].sort((a, b) => a.start - b.start);
};

export const applyAdvancedChords = async (songId: string, chords: ChordSegment[], start: number, end: number): Promise<'rebuilt' | 'kept-edited'> =>
  db.transaction('rw', [db.songs, db.analyses, db.charts], async () => {
    const [song, analysis, chart] = await Promise.all([db.songs.get(songId), db.analyses.where('songId').equals(songId).first(), db.charts.where('songId').equals(songId).first()]);
    if (!song || !analysis) throw new Error('Aguarde a análise inicial antes de aplicar os acordes.');
    const merged = mergeAdvancedChords(analysis.chords, chords, start, end);
    const stamp = now();
    await db.analyses.update(analysis.id, { chords: merged, models: { ...analysis.models, advancedChords: 'lv-browser-polyphase-v1' }, updatedAt: stamp });
    await db.songs.update(songId, { updatedAt: stamp });
    if (chart && chart.origin !== 'generated') return 'kept-edited';
    if (chart) {
      const chordPro = buildChart({ title: song.title, artist: song.artist, key: analysis.key, chords: merged, lines: analysis.lyrics?.lines ?? [] });
      await db.charts.update(chart.id, { chordPro, updatedAt: stamp });
    }
    return 'rebuilt';
  });
