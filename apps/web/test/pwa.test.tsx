import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallApp, InstallBanner, InstallButton, UpdateBanner } from '../src/components/PwaPrompts.tsx';
import { notifyNeedRefresh, notifyOfflineReady, resetPwaState } from '../src/lib/pwa.ts';
import { applyThemePref, setThemePref } from '../src/lib/theme.ts';

beforeEach(() => {
  resetPwaState();
  localStorage.clear();
});

describe('update banner', () => {
  it('stays hidden until there is something to say', () => {
    render(<UpdateBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers to reload into a new version', async () => {
    const update = vi.fn(async () => {});
    render(<UpdateBanner />);
    act(() => notifyNeedRefresh(update));
    expect(screen.getByText(/Nova versão disponível/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(update).toHaveBeenCalled();
  });

  it('says once when the app works offline, and can be dismissed', async () => {
    render(<UpdateBanner />);
    act(() => notifyOfflineReady());
    expect(screen.getByText(/funciona sem internet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(screen.queryByText(/funciona sem internet/)).toBeNull();
  });
});

describe('install', () => {
  it('shows the install button only after the browser allows it', async () => {
    render(<InstallApp />);
    expect(screen.queryByRole('button', { name: /Instalar/ })).toBeNull();
    const prompt = vi.fn(async () => {});
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    act(() => {
      window.dispatchEvent(event);
    });
    await userEvent.click(screen.getByRole('button', { name: /Instalar o will-music/ }));
    expect(prompt).toHaveBeenCalled();
  });
});

describe('theme color', () => {
  it('tints the browser bar with the app background', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    setThemePref('dark');
    expect(meta.content).toBe('#0b1220');
    setThemePref('light');
    applyThemePref();
    expect(meta.content).toBe('#f5f7fb');
    meta.remove();
  });
});

describe('install banner', () => {
  const offer = (prompt = vi.fn(async () => {})) => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
    act(() => {
      window.dispatchEvent(event);
    });
    return prompt;
  };

  it('offers to install once the browser allows it, and installs from the banner', async () => {
    render(<InstallBanner />);
    expect(screen.queryByText(/Instale o will-music/)).toBeNull();
    const prompt = offer();
    expect(screen.getByText(/Instale o will-music/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(prompt).toHaveBeenCalled();
  });

  it('remembers "Agora não" and stays hidden afterwards', async () => {
    const { unmount } = render(<InstallBanner />);
    offer();
    await userEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    expect(screen.queryByText(/Instale o will-music/)).toBeNull();
    unmount();
    render(<InstallBanner />);
    offer();
    expect(screen.queryByText(/Instale o will-music/)).toBeNull();
  });

  it('asks the browser to keep the data once installed', () => {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(persist).toHaveBeenCalled();
  });

  it('shows an install button in the top bar only when installable', () => {
    render(<InstallButton />);
    expect(screen.queryByRole('button', { name: /Instalar app/ })).toBeNull();
    offer();
    expect(screen.getByRole('button', { name: /Instalar app/ })).toBeInTheDocument();
  });
});
