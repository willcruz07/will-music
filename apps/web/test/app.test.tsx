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

describe('app version', () => {
  it('shows the version from package.json in the header', async () => {
    const { version } = await import('../package.json');
    const [major, minor] = version.split('.');
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(screen.getByText(`v${major}.${minor}`)).toBeInTheDocument();
    expect(version).toBe('3.0.0');
  });
});

describe('version label placement', () => {
  it('sits under the app name, in the same block', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    const label = screen.getByText(/^v\d+\.\d+$/);
    const name = screen.getByText('will-music');
    expect(label.parentElement).toBe(name.parentElement);
    expect(label.parentElement!.className).toMatch(/flex-col/);
  });
});

describe('tablet layout (iPad portrait, 768–1023px)', () => {
  it('keeps the bottom bar and leaves the top menu to wide screens (no overflowing header)', () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    const navs = screen.getAllByRole('navigation', { name: 'Principal' });
    const top = navs.find((n) => n.tagName === 'NAV' && n.className.includes('hidden'))!;
    const bottom = navs.find((n) => n.className.includes('fixed'))!;
    expect(top.className).toMatch(/\blg:flex\b/);
    expect(top.className).not.toMatch(/\bmd:flex\b/);
    expect(bottom.className).toMatch(/\blg:hidden\b/);
    expect(bottom.className).not.toMatch(/\bmd:hidden\b/);
  });
});
