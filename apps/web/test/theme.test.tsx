import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App.tsx';
import { applyThemePref, getThemePref, setThemePref } from '../src/lib/theme.ts';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('theme', () => {
  it('does not turn a light user dark after leaving the stage', () => {
    setThemePref('light');
    document.documentElement.classList.add('dark'); // the stage forced dark
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    act(() => applyThemePref());
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('wm-theme')).toBe('light');
  });

  it('keeps "system" as a real choice', () => {
    setThemePref('system');
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(getThemePref()).toBe('system');
    expect(localStorage.getItem('wm-theme')).toBeNull();
  });
});
