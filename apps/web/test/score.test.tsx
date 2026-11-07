import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { type ScoreRecord, db, deleteSong } from '../src/lib/db.ts';
import { buildSongScore, saveScore } from '../src/lib/score.ts';
import { Scores } from '../src/pages/Scores.tsx';
import { SongScore } from '../src/pages/SongScore.tsx';

vi.mock('../src/components/ScoreView.tsx', () => ({ ScoreView: ({ xml }: { xml: string }) => <div data-testid="score">{xml.length}</div> }));

const record = (songId: string): ScoreRecord => ({
  songId,
  notes: [
    { pitch: 64, start: 0, end: 0.45, velocity: 0.8 },
    { pitch: 67, start: 0.5, end: 0.95, velocity: 0.8 },
  ],
  bpm: 120,
  source: 'mix',
  model: 'nmp.onnx@test',
  createdAt: new Date().toISOString(),
});

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear(), db.scores.clear()]);
});

describe('song score', () => {
  it('builds MusicXML with the title, chords and tab', () => {
    const xml = buildSongScore(
      { title: 'Hino', artist: 'Coral' },
      { key: { root: 'G', mode: 'major', label: 'G major', index: 0, margin: 1 }, chords: [{ start: 0, end: 1, raw: 'G', label: 'G' }] },
      record('x'),
      { tab: true },
    );
    expect(xml).toContain('<work-title>Hino</work-title>');
    expect(xml).toContain('<fifths>1</fifths>');
    expect(xml).toContain('<root-step>G</root-step>');
    expect(xml).toContain('<sign>TAB</sign>');
  });

  it('uses the BPM override', () => {
    const xml = buildSongScore({ title: 'a', artist: '' }, undefined, record('x'), { tab: false, bpm: 90 });
    expect(xml).toContain('<per-minute>90</per-minute>');
  });

  it('is deleted together with the song', async () => {
    const song = await createManualSong('Hino', '');
    await saveScore(record(song.id));
    await deleteSong(song.id);
    expect(await db.scores.get(song.id)).toBeUndefined();
  });
});

describe('score pages', () => {
  it('lists songs with and without a score', async () => {
    const a = await createManualSong('Com partitura', '');
    await createManualSong('Sem partitura', '');
    await saveScore(record(a.id));
    render(
      <MemoryRouter>
        <Scores />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Com partitura')).toBeInTheDocument();
    expect(screen.getByText('Sem partitura')).toBeInTheDocument();
    expect(screen.getByText('Pronta')).toBeInTheDocument();
  });

  const openScore = (id: string) =>
    render(
      <MemoryRouter initialEntries={[`/musica/${id}/partitura`]}>
        <Routes>
          <Route path="/musica/:id/partitura" element={<SongScore />} />
        </Routes>
      </MemoryRouter>,
    );

  it('explains that a song without audio cannot be transcribed', async () => {
    const song = await createManualSong('Hino', '');
    openScore(song.id);
    expect(await screen.findByText(/precisa do áudio/)).toBeInTheDocument();
  });

  it('offers to generate when there is audio but no score', async () => {
    const song = await createManualSong('Hino', '');
    await db.audio.put({ songId: song.id, blob: new Blob(['x']), mimeType: 'audio/mpeg' });
    openScore(song.id);
    expect(await screen.findByRole('button', { name: /Gerar partitura/ })).toBeInTheDocument();
  });

  it('shows the score with tab and download controls', async () => {
    const song = await createManualSong('Hino', '');
    await saveScore(record(song.id));
    openScore(song.id);
    expect(await screen.findByTestId('score')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tablatura/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Baixar MusicXML/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Andamento (BPM)')).toHaveValue(120);
  });
});
