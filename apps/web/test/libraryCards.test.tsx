import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { createManualSong, saveEditedChart } from '../src/lib/chartEdit.ts';
import { db } from '../src/lib/db.ts';
import { Library } from '../src/pages/Library.tsx';
import { saveStudioScores } from '../src/lib/studioScore.ts';
vi.mock('../src/components/PackageButtons.tsx', () => ({ ImportButton: ({ onImported }: { onImported: (message: string) => void }) => <button onClick={() => onImported('Importado')}>Atualizar importação</button> }));

beforeEach(async () => { await Promise.all([db.songs.clear(), db.charts.clear(), db.scores.clear(), db.audio.clear(), db.analyses.clear()]); });
it('shows a chart preview and the transposed key in its card', async () => {
  const song = await createManualSong('Canção', 'Autor');
  await db.songs.update(song.id, { tempo: 120 });
  await saveEditedChart(song.id, '{key: C}\n[C]Uma letra para estudar');
  const chart = (await db.charts.where('songId').equals(song.id).first())!;
  await db.charts.update(chart.id, { transpose: 2, chordInstrument: 'teclado' });
  render(<MemoryRouter initialEntries={['/?aba=cifras']}><Library /></MemoryRouter>);
  expect(await screen.findByLabelText('Tom D')).toBeInTheDocument();
  expect(screen.getByText('Uma letra para estudar')).toBeInTheDocument();
  expect(screen.getByText('Transp. +2')).toBeInTheDocument();
  expect(screen.getByText('Teclado')).toBeInTheDocument();
  expect(screen.queryByText('≈ 120 BPM')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Excluir “Canção”' })).toBeInTheDocument();
});
it('shows the available saved parts and tempo on a score card', async () => {
  const song = await createManualSong('Arranjo', 'Autor');
  await saveStudioScores(song, { songId: song.id, notes: [{ pitch: 60, start: 0, end: 1, velocity: 1 }], bpm: 96, source: 'lead', model: '', createdAt: '' }, { melody: '<melody/>', keys: '<keys/>' });
  render(<MemoryRouter initialEntries={['/?aba=partituras']}><Library /></MemoryRouter>);
  expect(await screen.findByText('2 partes disponíveis para visualizar, tocar e imprimir.')).toBeInTheDocument();
  expect(screen.getByText('Melodia')).toBeInTheDocument();
  expect(screen.getByText('Teclado')).toBeInTheDocument();
  expect(screen.getByText('≈ 96 BPM')).toBeInTheDocument();
});
it('refreshes score cards after import while the score tab stays open', async () => {
  render(<MemoryRouter initialEntries={['/?aba=partituras']}><Library /></MemoryRouter>);
  await screen.findByText('Nenhuma partitura salva.');
  const song = await createManualSong('Importada', '');
  await saveStudioScores(song, { songId: song.id, notes: [], bpm: 110, source: 'lead', model: '', createdAt: '' }, { drums: '<drums/>' });
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar importação' }));
  expect(await screen.findByRole('link', { name: /Importada — Bateria/ })).toBeInTheDocument();
  expect(screen.getByText('Bateria')).toBeInTheDocument();
});
