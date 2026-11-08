import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preferPlayback } from '../src/lib/ios.ts';
import { PlayButton } from '../src/study/widgets.tsx';

const HINT = /Se não estiver ouvindo, verifique se o iPhone está no silencioso/;
const asIphone = () => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1');

afterEach(() => vi.restoreAllMocks());

describe('sound on iPhone', () => {
  it('shows the silent-switch hint in red under a play button on iOS', () => {
    asIphone();
    render(<PlayButton active={false} onClick={() => {}} label="progressão" />);
    const hint = screen.getByText(HINT);
    expect(hint.className).toMatch(/text-danger/);
  });

  it('does not show the hint elsewhere', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130');
    render(<PlayButton active={false} onClick={() => {}} label="progressão" />);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('asks the system for a playback audio session when it can (iOS 17+ plays even in silent mode)', () => {
    const session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
    preferPlayback();
    expect(session.type).toBe('playback');
    Reflect.deleteProperty(navigator, 'audioSession');
    expect(() => preferPlayback()).not.toThrow();
  });
});

describe('heavy separation on iPhone and iPad', () => {
  it('flags the 4/6-track modes (285 MB model) as heavy on iOS only', async () => {
    const { heavyOnThisDevice } = await import('../src/lib/stems.ts');
    asIphone();
    expect(heavyOnThisDevice('six')).toBe(true);
    expect(heavyOnThisDevice('four')).toBe(true);
    expect(heavyOnThisDevice('vocals')).toBe(false);
    vi.restoreAllMocks();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130');
    expect(heavyOnThisDevice('six')).toBe(false);
  });
});
