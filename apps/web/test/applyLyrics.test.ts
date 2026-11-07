import { beforeEach, describe, expect, it } from 'vitest';
import { applyLyrics } from '../src/lib/lyricsApply.ts';
import { createSong, db } from '../src/lib/db.ts';

const key = { root: 'G', mode: 'major' as const, label: 'G major', index: 10, margin: 0.1 };

const seed = async (origin: 'generated' | 'edited') => {
  const song = await createSong({ title: 'Primeiros Passos', artist: 'Ton Carfi', durationSec: 20 }, new Blob());
  await db.analyses.add({ id: 'a1', songId: song.id, schemaVersion: 1, models: {}, key, chords: [{ start: 0, end: 10, raw: 'G', label: 'G' }, { start: 10, end: 20, raw: 'C', label: 'C' }], createdAt: '', updatedAt: '' });
  await db.charts.add({ id: 'c1', songId: song.id, chordPro: '{title: x}\n[G] [C]', transpose: 2, fontSize: 18, origin, createdAt: '', updatedAt: '' });
  return song.id;
};

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
});

describe('applyLyrics', () => {
  it('stores the lyrics and rebuilds a generated chart, keeping transpose', async () => {
    const id = await seed('generated');
    const result = await applyLyrics(id, { source: 'manual', lines: [{ start: 1, text: 'Primeira linha' }, { start: 11, text: 'Segunda linha' }] });
    expect(result).toBe('rebuilt');
    const chart = await db.charts.get('c1');
    expect(chart!.chordPro).toContain('[G]Primeira linha');
    expect(chart!.chordPro).toContain('[C]Segunda linha');
    expect(chart!.transpose).toBe(2);
    expect((await db.analyses.get('a1'))!.lyrics!.lines).toHaveLength(2);
  });

  it('keeps an edited chart and only stores the lyrics', async () => {
    const id = await seed('edited');
    expect(await applyLyrics(id, { source: 'manual', lines: [{ start: 1, text: 'x' }] })).toBe('kept-edited');
    expect((await db.charts.get('c1'))!.chordPro).toBe('{title: x}\n[G] [C]');
    expect((await db.analyses.get('a1'))!.lyrics!.lines).toHaveLength(1);
  });
});
