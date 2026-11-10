import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { expect, it, vi } from 'vitest';
import { ChartChordShapes } from '../src/components/ChartChordShapes.tsx';
import { SongInfoForm } from '../src/components/SongInfoForm.tsx';
import type { Chart, Song } from '../src/lib/db.ts';
vi.mock('../src/components/ChordDiagram.tsx', () => ({
  INSTRUMENT_NAMES: { violao: 'Violão', teclado: 'Teclado', cavaquinho: 'Cavaquinho' },
  ChordDiagram: ({ chord, variant, onVariants }: { chord: string; variant: number; onVariants: (n: number) => void }) => {
    useEffect(() => onVariants(3), [onVariants]);
    return <figure role="img" aria-label={chord} data-variant={variant} />;
  },
}));
it('shows unique chords and lets each shape change independently', async () => {
  const chart: Chart = { id: 'chart', songId: 'song', chordPro: '[C]Um [G]dois [C]três', transpose: 0, fontSize: 18, origin: 'manual', createdAt: '', updatedAt: '' };
  const onChange = vi.fn();
  const { rerender } = render(<ChartChordShapes chart={chart} onChange={onChange} defaultInstrument="violao" />);
  expect(screen.getAllByRole('img')).toHaveLength(2);
  fireEvent.click(await screen.findByRole('button', { name: 'Próxima formação de C' }));
  expect(onChange).toHaveBeenCalledWith({ C: { instrument: 'violao', variant: 1 } }, 'violao');
  rerender(<ChartChordShapes chart={{ ...chart, chordShapes: { C: { instrument: 'violao', variant: 1 } } }} onChange={onChange} defaultInstrument="violao" />);
  expect(screen.getByRole('img', { name: 'C' })).toHaveAttribute('data-variant', '1');
  expect(screen.queryByRole('combobox')).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'Teclado' }));
  expect(onChange).toHaveBeenLastCalledWith({ C: { instrument: 'teclado', variant: 0 }, G: { instrument: 'teclado', variant: 0 } }, 'teclado');
});
it('keeps meter and folder out of the simplified metadata form and its update', async () => {
  const song: Song = { id: 'song', title: 'Música', artist: 'Artista', favorite: false, durationSec: 0, analysisStatus: 'done', timeSignature: '3/4', folder: 'Existente', createdAt: '', updatedAt: '' };
  const onSave = vi.fn();
  render(<SongInfoForm basic song={song} onSave={onSave} />);
  expect(screen.queryByLabelText('Compasso')).toBeNull();
  expect(screen.queryByLabelText('Pasta')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar dados' }));
  await waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0]![0]).not.toHaveProperty('folder');
  expect(onSave.mock.calls[0]![0]).not.toHaveProperty('timeSignature');
});

it('keeps diagram choices attached to their original chords when transposing', async () => {
  const chart: Chart = { id: 'transposed', songId: 'song', chordPro: '[C]Um [D]dois', transpose: 2, fontSize: 18, origin: 'manual', createdAt: '', updatedAt: '', chordInstrument: 'teclado', chordShapes: { C: { instrument: 'teclado', variant: 1 }, D: { instrument: 'teclado', variant: 2 } } };
  const onChange = vi.fn();
  render(<ChartChordShapes chart={chart} onChange={onChange} defaultInstrument="violao" />);
  expect(screen.getByRole('radio', { name: 'Teclado' })).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByRole('img', { name: 'D' })).toHaveAttribute('data-variant', '1');
  expect(screen.getByRole('img', { name: 'E' })).toHaveAttribute('data-variant', '2');
  fireEvent.click(await screen.findByRole('button', { name: 'Próxima formação de D' }));
  expect(onChange).toHaveBeenLastCalledWith({ C: { instrument: 'teclado', variant: 2 }, D: { instrument: 'teclado', variant: 2 } }, 'teclado');
});
