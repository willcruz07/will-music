import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { db, deleteSong, type StemsRecord } from '../src/lib/db.ts';
import { generateStudioScore, saveStudioScore, saveStudioScores } from '../src/lib/studioScore.ts';
import { buildScoreXml, deleteSavedScore, runWorker, scoreGrid } from '../src/lib/score.ts';
import { Library } from '../src/pages/Library.tsx';
import { BottomNav } from '../src/components/AppNav.tsx';

const notes = [{ pitch: 60, start: 0, end: 0.8, velocity: 0.9 }, { pitch: 64, start: 1, end: 1.8, velocity: 0.9 }];
const tracks: StemsRecord['tracks'] = (['vocals', 'guitar', 'piano', 'drums'] as const).map(name => ({ name, blob: new Blob([name], { type: 'audio/mpeg' }) }));
beforeEach(async () => { await Promise.all([db.songs.clear(), db.charts.clear(), db.scores.clear(), db.audio.clear(), db.analyses.clear()]); });

it('reuses vocal notes for choir without running the model a second time', async () => {
  const song = await createManualSong('Origem', '');
  const decode = vi.fn(async () => new Float32Array(8));
  const run = vi.fn(async () => ({ notes, model: 'test' }));
  const melody = await generateStudioScore('melody', song, tracks, undefined, () => {}, undefined, { decode, run });
  const choir = await generateStudioScore('choir', song, tracks, melody, () => {}, undefined, { decode, run });
  expect(decode).toHaveBeenCalledWith(tracks[0]!.blob, expect.any(Number));
  expect(run).toHaveBeenCalledTimes(1);
  expect(choir.choir?.source).toBe('vocals');
  expect(await db.scores.count()).toBe(0);
});

it('transcribes the guitar track independently from the vocal melody', async () => {
  const song = await createManualSong('Origem', '');
  const decode = vi.fn(async () => new Float32Array(8));
  const run = vi.fn(async () => ({ notes, model: 'test' }));
  const score = await generateStudioScore('guitar', song, tracks, undefined, () => {}, undefined, { decode, run });
  expect(decode).toHaveBeenCalledWith(tracks[1]!.blob, expect.any(Number));
  expect(score.guitar?.notes).toEqual(notes);
  expect(score.notes).toEqual([]);
  expect(buildScoreXml('guitar', song, undefined, score)).toContain('<sign>TAB</sign>');
});

it('saves an independent score that survives deletion of its source, without audio or raw voice cache', async () => {
  const song = await createManualSong('Origem', 'Autor');
  const score = { songId: song.id, notes, vocalNotes: notes, source: 'lead' as const, model: 'test', bpm: 120, createdAt: '' };
  const xml = buildScoreXml('melody', song, undefined, score)!;
  const grid = scoreGrid('melody', undefined, score);
  const saved = await saveStudioScore(song, score, 'melody', xml, grid);
  await deleteSong(song.id);
  const snapshot = (await db.scores.get(saved.id))!;
  expect(await db.audio.get(saved.id)).toBeUndefined();
  expect(await db.charts.where('songId').equals(saved.id).count()).toBe(0);
  expect(snapshot).not.toHaveProperty('vocalNotes');
  expect(buildScoreXml('melody', saved, undefined, snapshot)).toBe(xml);
  expect(scoreGrid('melody', undefined, snapshot)).toEqual(grid);
  render(<MemoryRouter initialEntries={['/?aba=partituras']}><Library /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: /Origem — Melodia/ })).toHaveAttribute('href', `/musica/${saved.id}/partitura`);
});

it('rejects cancelled jobs before creating a worker', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(runWorker(new Float32Array(4), true, () => {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

it('removes a standalone saved score without deleting its original song or audio', async () => {
  const source = await createManualSong('Original', '');
  await db.audio.put({ songId: source.id, blob: new Blob(['audio']), mimeType: 'audio/mpeg' });
  const score = { songId: source.id, notes, source: 'lead' as const, model: '', bpm: 120, createdAt: '' };
  const saved = await saveStudioScore(source, score, 'melody', buildScoreXml('melody', source, undefined, score)!);
  await deleteSavedScore(saved.id);
  expect(await db.scores.get(saved.id)).toBeUndefined();
  expect(await db.songs.get(saved.id)).toBeUndefined();
  expect(await db.audio.get(source.id)).toBeDefined();
  expect(await db.songs.get(source.id)).toBeDefined();
});

it('only deletes the score when it belongs to a song that still has audio or a chart', async () => {
  const source = await createManualSong('Original', '');
  await db.scores.put({ songId: source.id, notes, source: 'mix', model: '', bpm: 120, createdAt: '' });
  await deleteSavedScore(source.id);
  expect(await db.scores.get(source.id)).toBeUndefined();
  expect(await db.songs.get(source.id)).toBeDefined();
  expect(await db.charts.where('songId').equals(source.id).count()).toBe(1);
});

it('saves all ready parts in one entry and keeps each document and its grid', async () => {
  const song = await createManualSong('Conjunto', '');
  const score = { songId: song.id, notes, vocalNotes: notes, guitar: { notes, source: 'guitar' }, piano: { notes, source: 'piano' }, source: 'lead' as const, model: 'test', bpm: 120, createdAt: '' };
  const types = ['melody', 'guitar', 'keys'] as const;
  const documents = Object.fromEntries(types.map(type => [type, buildScoreXml(type, song, undefined, score)!]));
  const grids = Object.fromEntries(types.map(type => [type, scoreGrid(type, undefined, score)!]));
  const saved = await saveStudioScores(song, score, documents, grids, 'guitar');
  const snapshot = (await db.scores.get(saved.id))!;
  expect(await db.scores.count()).toBe(1);
  expect(snapshot.savedType).toBe('guitar');
  expect(Object.keys(snapshot.documents!)).toEqual(types);
  for (const type of types) {
    expect(buildScoreXml(type, saved, undefined, snapshot)).toBe(documents[type]);
    expect(scoreGrid(type, undefined, snapshot)).toEqual(grids[type]);
  }
  expect(snapshot).not.toHaveProperty('vocalNotes');
  expect(await db.audio.get(saved.id)).toBeUndefined();
});

it('offers Microfone instead of Partituras in the bottom navigation', () => {
  render(<MemoryRouter><BottomNav /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Microfone' })).toHaveAttribute('href', '/microfone');
  expect(screen.queryByRole('link', { name: 'Partituras' })).not.toBeInTheDocument();
});
