import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { type ScoreRecord, db } from '../src/lib/db.ts';

let finish: (s: ScoreRecord) => void = () => {};
vi.mock('../src/components/ScoreView.tsx', () => ({ ScoreView: () => <div data-testid="score" /> }));
vi.mock('../src/lib/score.ts', async (load) => ({
  ...(await load<typeof import('../src/lib/score.ts')>()),
  transcribeMelody: () => new Promise<ScoreRecord>((resolve) => (finish = resolve)),
}));
const { SongScore } = await import('../src/pages/SongScore.tsx');

describe('score page navigation', () => {
  it('does not show song A’s melody on song B when A finishes later', async () => {
    const a = await createManualSong('Canção A', '');
    const b = await createManualSong('Canção B', '');
    for (const s of [a, b]) await db.audio.put({ songId: s.id, blob: new Blob(['x']), mimeType: 'audio/mpeg' });
    render(
      <MemoryRouter initialEntries={[`/musica/${a.id}/partitura`]}>
        <Link to={`/musica/${b.id}/partitura`}>ir para B</Link>
        <Routes>
          <Route path="/musica/:id/partitura" element={<SongScore />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /Gerar partitura/ }));
    await userEvent.click(screen.getByRole('link', { name: 'ir para B' }));
    expect(await screen.findByRole('link', { name: /Canção B/ })).toBeInTheDocument();
    await act(async () => finish({ songId: a.id, notes: [{ pitch: 60, start: 0, end: 1, velocity: 1 }], bpm: 100, source: 'mix', model: 'x', createdAt: '' }));
    expect(screen.queryByTestId('score')).toBeNull();
    expect(screen.getByRole('button', { name: /Gerar partitura/ })).toBeEnabled();
  });
});
