import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Player } from '../src/components/Player.tsx';

describe('player drawer backdrop', () => {
  it('dims and blurs the page while the controls are open, and a tap on it closes them', () => {
    render(<Player sources={[{ name: 'instrumental', src: 'blob:a', volume: 1 }]} onTime={() => {}} />);
    expect(screen.queryByTestId('player-backdrop')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
    const backdrop = screen.getByTestId('player-backdrop');
    expect(backdrop.className).toMatch(/backdrop-blur/);
    fireEvent.click(backdrop);
    expect(screen.getByRole('button', { name: 'Abrir controles' })).toBeInTheDocument();
    expect(screen.queryByTestId('player-backdrop')).toBeNull();
  });
});
