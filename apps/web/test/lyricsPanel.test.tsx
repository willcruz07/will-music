import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LyricsPanel } from '../src/components/LyricsPanel.tsx';
import type { LrclibResult } from '../src/lib/lrclib.ts';

const result: LrclibResult = { id: 42, trackName: 'Primeiros Passos', artistName: 'Vida Reluz', duration: 210, syncedLyrics: '[00:05.00] Primeira linha\n[00:09.00] Segunda', plainLyrics: null };

describe('LyricsPanel', () => {
  it('searches with the edited title and artist and applies a chosen result', async () => {
    const search = vi.fn(async () => [result]);
    const onApply = vi.fn();
    render(<LyricsPanel title="Primeiros Passos" artist="Ton Carfi" durationSec={208} search={search} onApply={onApply} />);
    await userEvent.clear(screen.getByLabelText('Artista'));
    await userEvent.click(screen.getByRole('button', { name: 'Buscar letra' }));
    expect(search).toHaveBeenCalledWith('Primeiros Passos', '');
    expect(await screen.findByText('Vida Reluz')).toBeInTheDocument();
    expect(screen.getByText(/sincronizada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Usar esta letra/ }));
    expect(onApply).toHaveBeenCalledWith({ source: 'lrclib', lrclibId: 42, lines: [{ start: 5, text: 'Primeira linha' }, { start: 9, text: 'Segunda' }] });
  });

  it('tells the user when nothing is found', async () => {
    render(<LyricsPanel title="x" artist="y" durationSec={100} search={async () => []} onApply={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Buscar letra' }));
    expect(await screen.findByText(/Nenhuma letra encontrada/)).toBeInTheDocument();
  });

  it('applies pasted lyrics spread over the song', async () => {
    const onApply = vi.fn();
    render(<LyricsPanel title="x" artist="y" durationSec={100} search={async () => []} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText('Colar a letra'), { target: { value: 'um\ndois' } });
    await userEvent.click(screen.getByRole('button', { name: 'Usar a letra colada' }));
    expect(onApply).toHaveBeenCalledWith({ source: 'manual', lines: [{ start: 10, text: 'um' }, { start: 50, text: 'dois' }] });
  });
});
