import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, useNavigate } from 'react-router';
import { RouteScrollReset } from '../src/components/RouteScrollReset.tsx';

const Navigation = () => {
  const navigate = useNavigate();
  return <><RouteScrollReset /><Link to="/catalogo/um">Abrir cifra</Link><Link to="/?aba=catalogo&busca=Amor">Filtrar</Link><button onClick={() => navigate(-1)}>Voltar</button></>;
};
afterEach(() => vi.restoreAllMocks());
it('resets on new paths and browser back, without resetting for catalog filters', () => {
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  render(<MemoryRouter initialEntries={['/?aba=catalogo']}><Navigation /></MemoryRouter>);
  expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  scroll.mockClear();
  fireEvent.click(screen.getByText('Filtrar'));
  expect(scroll).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Abrir cifra'));
  expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
  scroll.mockClear();
  fireEvent.click(screen.getByText('Voltar'));
  expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' });
});
it('disables native history restoration while mounted and restores it on exit', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const old = window.history.scrollRestoration;
  window.history.scrollRestoration = 'auto';
  try {
    const { unmount } = render(<MemoryRouter><RouteScrollReset /></MemoryRouter>);
    expect(window.history.scrollRestoration).toBe('manual');
    unmount();
    expect(window.history.scrollRestoration).toBe('auto');
  } finally { window.history.scrollRestoration = old; }
});
