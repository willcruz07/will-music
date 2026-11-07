import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { db } from '../src/lib/db.ts';
import { Song } from '../src/pages/Song.tsx';

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
});

describe('song page without audio', () => {
  it('offers editing but not re-analysis, player or sync', async () => {
    const song = await createManualSong('Hino', '');
    render(
      <MemoryRouter initialEntries={[`/musica/${song.id}`]}>
        <Routes>
          <Route path="/musica/:id" element={<Song />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: /Editar cifra/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analisar de novo' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sincronizar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tocar' })).toBeNull();
  });
});
