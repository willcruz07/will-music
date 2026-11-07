import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { type ScoreRecord, db } from '../src/lib/db.ts';
import { CHOIR_NEEDS_STEMS, buildScoreXml, hasScoreType, saveScore, transcribeChoir } from '../src/lib/score.ts';
import { SongScore } from '../src/pages/SongScore.tsx';

vi.mock('../src/components/ScoreView.tsx', () => ({ ScoreView: () => <div data-testid="score" /> }));

const n = (pitch: number, start: number) => ({ pitch, start, end: start + 0.9, velocity: 0.8 });
const choirScore = (songId: string): ScoreRecord => ({
  songId,
  notes: [n(60, 0), n(62, 1), n(64, 2), n(65, 3), n(67, 4), n(69, 5), n(67, 6), n(65, 7), n(64, 8), n(62, 9), n(60, 10), n(57, 11), n(55, 12)],
  bpm: 60,
  source: 'lead',
  model: 'x',
  createdAt: '',
  choir: { voices: { S: [n(72, 0)], A: [n(64, 0)], T: [n(55, 0)], B: [n(48, 0)] }, source: 'vocals' },
});

beforeEach(() => Promise.all([db.songs.clear(), db.audio.clear(), db.scores.clear(), db.charts.clear(), db.stemSets.clear()]));

describe('choir score', () => {
  it('writes the four voices with the lyric lines', () => {
    const score = choirScore('x');
    expect(hasScoreType(score, 'choir')).toBe(true);
    const xml = buildScoreXml('choir', { title: 'Hino', artist: '' }, undefined, score, { lyrics: [{ time: 0, text: 'Santo' }] })!;
    expect(xml.match(/<score-part id=/g)).toHaveLength(4);
    expect(xml).toContain('<words>Santo</words>');
  });

  it('asks for separated voices first', async () => {
    const song = await createManualSong('Hino', '');
    await db.audio.put({ songId: song.id, blob: new Blob(['x']), mimeType: 'audio/mpeg' });
    await expect(transcribeChoir(song, () => {})).rejects.toThrow(CHOIR_NEEDS_STEMS);
  });

  it('shows the choir score, the lead voice type and the lyric strip', async () => {
    const song = await createManualSong('Hino', '');
    await db.charts.where('songId').equals(song.id).modify({ chordPro: '{title: Hino}\n[C]Santo, santo\n[G]Senhor', lineTimes: [0, 4] });
    await saveScore(choirScore(song.id));
    render(
      <MemoryRouter initialEntries={[`/musica/${song.id}/partitura`]}>
        <Routes>
          <Route path="/musica/:id/partitura" element={<SongScore />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('radio', { name: /Coral \(SATB\)/ }));
    expect(await screen.findByTestId('score')).toBeInTheDocument();
    expect(screen.getByText(/Voz principal: extensão/)).toHaveTextContent(/Tenor|Barítono|Contralto|Baixo|Soprano|Mezzo/);
    expect(screen.getByText('Santo, santo')).toBeInTheDocument(); // first line waiting in the lyric strip
  });
});
