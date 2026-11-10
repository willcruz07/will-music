import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import { Studio } from '../src/components/Studio.tsx';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { db } from '../src/lib/db.ts';
import { saveStudioChart } from '../src/lib/studioChart.ts';
import type { StemsState } from '../src/lib/useStems.ts';

beforeEach(async () => { await Promise.all([db.audio.clear(), db.songs.clear(), db.charts.clear(), db.analyses.clear()]); });

it('saves a chart without copying audio, analysis or its source id', async () => {
  const source = await createManualSong('Estudo', 'Autor');
  await db.audio.put({ songId: source.id, blob: new Blob(['audio']), mimeType: 'audio/mpeg' });
  const chart = (await db.charts.where('songId').equals(source.id).first())!;
  const copy = await saveStudioChart(source, { ...chart, chordPro: '[G]Texto editado', transpose: 2, chordInstrument: 'cavaquinho', chordShapes: { G: { instrument: 'cavaquinho', variant: 2 } } });
  expect(copy.id).not.toBe(source.id);
  expect(await db.audio.get(copy.id)).toBeUndefined();
  expect(await db.analyses.where('songId').equals(copy.id).count()).toBe(0);
  expect((await db.charts.where('songId').equals(copy.id).first())!).toMatchObject({ chordPro: '[G]Texto editado', transpose: 2, origin: 'manual', chordInstrument: 'cavaquinho', chordShapes: { G: { instrument: 'cavaquinho', variant: 2 } } });
  expect(await db.audio.get(source.id)).toBeDefined();
});

it('keeps the player mounted across tabs and prevents editing during analysis', async () => {
  const source = await createManualSong('Estudo', '');
  const chart = (await db.charts.where('songId').equals(source.id).first())!;
  chart.chordPro = '[G]Texto inicial';
  const edit = vi.fn().mockRejectedValue(new Error('Gravação recusada'));
  const stems = { hasStems: false, modes: [], mix: [], progress: null, error: null, temporaryTracks: false, separate: vi.fn() } as unknown as StemsState;
  render(<MemoryRouter><Studio song={source} chart={chart} progress={{ label: 'Analisando' }} stems={stems} player={<div data-testid="shared-player" />} activeLine={-1} currentIndex={-1} autoScroll={false} recovery={null} onSeek={vi.fn()} getTime={() => 0} onChord={vi.fn()} onEdit={edit} onRetry={vi.fn()} /></MemoryRouter>);
  const player = screen.getByTestId('shared-player');
  fireEvent.click(screen.getByRole('tab', { name: 'Tracks' }));
  expect(screen.getByText('Aguardando letra e acordes para iniciar a separação.')).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: /Letras/ }));
  expect(screen.getByTestId('shared-player')).toBe(player);
  // Pending analysis must not let an edit race the generated chart.
  expect(screen.getByRole('button', { name: 'Editar letra e cifra' })).toBeDisabled();
});

it('prefills the ChordPro editor and retains typed text when saving fails', async () => {
  const source = await createManualSong('Estudo', '');
  const chart = (await db.charts.where('songId').equals(source.id).first())!;
  const edit = vi.fn().mockRejectedValue(new Error('Gravação recusada'));
  const stems = { hasStems: false, modes: [], mix: [], progress: null, error: null, temporaryTracks: false, separate: vi.fn() } as unknown as StemsState;
  render(<MemoryRouter><Studio song={source} chart={{ ...chart, chordPro: '[G]Inicial' }} progress={null} stems={stems} player={<div />} activeLine={-1} currentIndex={-1} autoScroll={false} recovery={null} onSeek={vi.fn()} getTime={() => 0} onChord={vi.fn()} onEdit={edit} onRetry={vi.fn()} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Editar letra e cifra' }));
  const input = screen.getByRole('textbox', { name: 'Cifra em ChordPro' });
  expect(input).toHaveValue('[G]Inicial');
  fireEvent.change(input, { target: { value: '[G]Correção' } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar alterações' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Gravação recusada'));
  expect(input).toHaveValue('[G]Correção');
});
