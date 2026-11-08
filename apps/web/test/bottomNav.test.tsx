import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BottomNav, bottomNavHidden } from '../src/components/AppNav.tsx';

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );

describe('bottom bar inside a study', () => {
  it('shows on /estudo and the other main screens', () => {
    for (const path of ['/estudo', '/', '/listas', '/partituras']) expect(bottomNavHidden(path)).toBe(false);
  });

  it('hides on every screen inside a study', () => {
    for (const path of ['/estudo/aula/1', '/estudo/trilha/violao', '/estudo/ferramentas', '/estudo/constelacao']) expect(bottomNavHidden(path)).toBe(true);
  });

  it('drops the bar and the room kept for it', () => {
    const { unmount } = at('/estudo/aula/1');
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    expect(document.documentElement.dataset.nav).toBe('none');
    unmount();
    expect(document.documentElement.dataset.nav).toBeUndefined();
    at('/estudo');
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(document.documentElement.dataset.nav).toBeUndefined();
  });
});
