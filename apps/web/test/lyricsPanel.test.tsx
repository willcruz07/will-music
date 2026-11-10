import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LyricsPanel } from '../src/components/LyricsPanel.tsx';
describe('LyricsPanel', () => {
  it('offers manual lyrics without an external search option', () => {
    render(<LyricsPanel durationSec={100} onApply={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Buscar letra' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Colar a letra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar a letra colada' })).toBeDisabled();
  });

  it('applies pasted lyrics spread over the song', async () => {
    const onApply = vi.fn();
    render(<LyricsPanel durationSec={100} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText('Colar a letra'), { target: { value: 'um\ndois' } });
    await userEvent.click(screen.getByRole('button', { name: 'Usar a letra colada' }));
    expect(onApply).toHaveBeenCalledWith({ source: 'manual', lines: [{ start: 10, text: 'um' }, { start: 50, text: 'dois' }] });
  });
});
