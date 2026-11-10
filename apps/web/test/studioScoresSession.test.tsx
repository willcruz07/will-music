import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';
import { StudioScores } from '../src/components/StudioScores.tsx';
import { generateStudioScore } from '../src/lib/studioScore.ts';
import type { Song, StemsRecord } from '../src/lib/db.ts';
vi.mock('../src/lib/studioScore.ts', async load => ({ ...(await load<typeof import('../src/lib/studioScore.ts')>()), generateStudioScore: vi.fn() }));
vi.mock('../src/components/ScoreView.tsx', () => ({ ScoreView: () => <div /> }));

it('never reuses vocal cache from a previous stem set when generating after a track change', async () => {
  const song: Song = { id: 'session', title: 'Sessão', artist: '', durationSec: 10, favorite: false, analysisStatus: 'done', createdAt: '', updatedAt: '' };
  const notes = [{ pitch: 60, start: 0, end: 1, velocity: 1 }];
  const oldTracks: StemsRecord['tracks'] = [{ name: 'vocals', blob: new Blob(['old']) }];
  const newTracks: StemsRecord['tracks'] = [{ name: 'vocals', blob: new Blob(['new']) }];
  vi.mocked(generateStudioScore).mockResolvedValue({ songId: song.id, notes, vocalNotes: notes, bpm: 120, source: 'lead', model: '', createdAt: '' });
  const view = (active: boolean, tracks: StemsRecord['tracks']) => <MemoryRouter><StudioScores song={song} tracks={tracks} active={active} waiting={false} /></MemoryRouter>;
  const { rerender } = render(view(true, oldTracks));
  await screen.findByRole('button', { name: /Salvar partituras \(1\)/ });
  rerender(view(false, oldTracks));
  fireEvent.click(screen.getByRole('tab', { name: 'Coral (SATB)' }));
  rerender(view(true, newTracks));
  await waitFor(() => expect(generateStudioScore).toHaveBeenCalledTimes(2));
  expect(vi.mocked(generateStudioScore).mock.calls[1]![3]).toBeUndefined();
});
