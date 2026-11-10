import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { db } from '../src/lib/db.ts';
import { Song } from '../src/pages/Song.tsx';
import { clearPendingAnalysis, getPendingAnalysis, setPendingAnalysis } from '../src/lib/pendingAnalysis.ts';

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
});

describe('song page without audio', () => {
  it('renders an unsaved result and saves it without a new analysis', async () => {
    const song = await createManualSong('Recuperada', '');
    const original = (await db.charts.where('songId').equals(song.id).first())!;
    await db.charts.delete(original.id);
    setPendingAnalysis({ song, chart: { ...original, origin: 'generated', chordPro: '[C]Trecho recuperado', lineTimes: [0] },
      analysis: { id: 'pending-test', songId: song.id, schemaVersion: 1, models: {}, key: { root: 'C', mode: 'major', label: 'C major', index: 0, margin: 1 },
        chords: [{ start: 0, end: 4, raw: 'C:maj', label: 'C' }], lyrics: { source: 'transcription', lines: [{ start: 0, text: 'Trecho recuperado' }] }, createdAt: '', updatedAt: '' } });
    try {
      render(<MemoryRouter initialEntries={[`/musica/${song.id}`]}><Routes><Route path="/musica/:id" element={<Song />} /></Routes></MemoryRouter>);
      await userEvent.click(await screen.findByText('Salvar ou exportar resultado'));
      expect(screen.getByText('Trecho recuperado')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Exportar resultado' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Tentar salvar sem reanalisar' }));
      await waitFor(() => expect(getPendingAnalysis(song.id)).toBeUndefined());
      await waitFor(() => expect(screen.queryByText('Salvar ou exportar resultado')).not.toBeInTheDocument());
      expect((await db.charts.where('songId').equals(song.id).first())!.chordPro).toBe('[C]Trecho recuperado');
    } finally { clearPendingAnalysis(song.id); }
  });

  it('offers editing but not re-analysis, player or sync', async () => {
    const song = await createManualSong('Hino', '');
    render(
      <MemoryRouter initialEntries={[`/musica/${song.id}`]}>
        <Routes>
          <Route path="/musica/:id" element={<Song />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: /Editar letra e cifra/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Analisar de novo' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Sincronizar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tocar' })).toBeNull();
  });
});

describe('song page toolbar on mobile', () => {
  it('groups the reading controls and chart actions in wrapping rows', async () => {
    const song = await createManualSong('Hino', '');
    render(
      <MemoryRouter initialEntries={[`/musica/${song.id}`]}>
        <Routes>
          <Route path="/musica/:id" element={<Song />} />
        </Routes>
      </MemoryRouter>,
    );
    const toolbar = await screen.findByRole('toolbar', { name: 'Ferramentas da música' });
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Meio tom acima' }));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Aumentar letra' }));
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Imprimir cifra' }));
    expect(screen.queryByRole('link', { name: 'Palco' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Partitura' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dados' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir música' })).toBeNull();
  });
});
