import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.tsx';

describe('App shell', () => {
  it('renders the library at / with the app name', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
    expect(screen.getByText('will-music')).toBeInTheDocument();
  });

  it('toggles dark mode', async () => {
    document.documentElement.classList.remove('dark');
    render(<MemoryRouter><App /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: /tema/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('screen stays on while the app is open', () => {
  it('asks for a screen wake lock on the library', async () => {
    const request = vi.fn(async () => ({ release: vi.fn(async () => {}) }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    Reflect.deleteProperty(navigator, 'wakeLock');
  });
});
