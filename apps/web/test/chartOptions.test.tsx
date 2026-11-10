import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { createManualSong, saveEditedChart } from '../src/lib/chartEdit.ts';
import { db } from '../src/lib/db.ts';
import { createSetlist } from '../src/lib/setlists.ts';
import { Song } from '../src/pages/Song.tsx';
import { DialogHost } from '../src/ui/Dialog.tsx';
vi.mock('../src/components/ChordDiagram.tsx', () => ({
  INSTRUMENT_NAMES: { violao: 'Violão', teclado: 'Teclado', cavaquinho: 'Cavaquinho' },
  ChordDiagram: ({ chord, onVariants }: { chord: string; onVariants?: (n: number) => void }) => { useEffect(() => onVariants?.(3), [onVariants]); return <figure role="img" aria-label={`Diagrama de ${chord}`} />; },
}));
beforeEach(async () => { await Promise.all([db.songs.clear(), db.charts.clear(), db.audio.clear(), db.analyses.clear(), db.setlists.clear()]); });
const open = async () => {
  const song = await createManualSong('Minha cifra', '');
  await db.songs.update(song.id, { key: 'C' });
  await saveEditedChart(song.id, '[C]Texto inicial');
  render(<MemoryRouter initialEntries={[`/musica/${song.id}`]}><Routes><Route path="/musica/:id" element={<Song />} /></Routes><DialogHost /></MemoryRouter>);
  await screen.findByRole('button', { name: 'Editar letra e cifra' });
  return song;
};
it('updates transposed chords, diagrams, font size and the text saved through the sheet', async () => {
  const song = await open();
  fireEvent.click(screen.getByRole('button', { name: 'Meio tom acima' }));
  expect(await screen.findByRole('button', { name: 'Como tocar C#' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Diagrama de C#' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar letra' }));
  await screen.findByText('20px');
  fireEvent.click(screen.getByRole('button', { name: 'Editar letra e cifra' }));
  const editor = screen.getByRole('textbox', { name: 'Cifra em ChordPro' });
  expect(editor).toHaveValue('[C]Texto inicial');
  fireEvent.change(editor, { target: { value: '[G]Texto modificado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  expect(await screen.findByRole('button', { name: 'Como tocar G#' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Diagrama de G#' })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect((await db.charts.where('songId').equals(song.id).first())!).toMatchObject({ chordPro: '[G]Texto modificado', transpose: 1, fontSize: 20 });
});
it('creates a named list and links the chart in the same action', async () => {
  const song = await open();
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar a uma lista' }));
  await screen.findByText(/Você ainda não tem listas/);
  fireEvent.change(screen.getByRole('textbox', { name: 'Nome da nova lista' }), { target: { value: 'Ensaio' } });
  fireEvent.click(screen.getByRole('button', { name: 'Criar lista e adicionar cifra' }));
  await screen.findByText('Adicionada a “Ensaio”.');
  expect((await db.setlists.toArray())[0]).toMatchObject({ name: 'Ensaio', items: [{ songId: song.id }] });
});
it('shows existing lists in a modal and links the selected one', async () => {
  const song = await open();
  const list = await createSetlist('Culto');
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar a uma lista' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Culto' }));
  await screen.findByText('Adicionada a “Culto”.');
  expect((await db.setlists.get(list.id))!.items).toEqual([{ songId: song.id }]);
});
