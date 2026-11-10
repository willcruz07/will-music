import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Player } from '../src/components/Player.tsx';

it('shows BPM and maps its slider to playback speed relative to the original tempo', () => {
  render(<Player src="blob:test" onTime={vi.fn()} studio={{ artist: '', tempo: 120, keyLabel: 'C' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'BPM e tom' }));
  const slider = screen.getByRole('slider', { name: 'Andamento em BPM' });
  expect(slider).toHaveValue('120');
  fireEvent.change(slider, { target: { value: '90' } });
  expect(document.querySelector('audio')!.playbackRate).toBe(0.75);
  expect(screen.queryByText('75%')).not.toBeInTheDocument();
});
