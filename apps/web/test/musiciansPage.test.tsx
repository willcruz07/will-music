import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../src/lib/cloud/musicians.ts', () => ({ listMusicians: fake.list, musiciansError: (error: unknown) => String(error) }));
import { Musicians } from '../src/pages/Musicians.tsx';
import { choose } from './choose.ts';
const musician = { uid: 'target', name: 'João', photo: '', bio: '', location: { country: 'Brasil', region: 'SP', city: 'São Paulo' }, instruments: ['Teclado'], styles: ['Jazz'], experience: '', socials: {}, acceptsInvites: true };
const page = (more = false) => ({ items: [musician], cursor: more ? { id: 'cursor' } : null, more });
beforeEach(() => {
  fake.list.mockReset().mockResolvedValue(page());
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
describe('musician directory screen', () => {
  it('displays compact profiles and submits combined filters to the service', async () => {
    render(<MemoryRouter><Musicians /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'João' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /João/ })).toHaveAttribute('href', '/musicos/target');
    await choose('Filtrar por instrumento', 'Teclado');
    await choose('Filtrar por estilo', 'Jazz');
    fireEvent.change(screen.getByLabelText('Buscar músico pelo início do nome'), { target: { value: 'João' } });
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(fake.list).toHaveBeenLastCalledWith(expect.objectContaining({ instrument: 'Teclado', style: 'Jazz', name: 'João' }), null));
  });
  it('restarts pagination when filters are cleared instead of reusing an old cursor', async () => {
    fake.list.mockResolvedValue(page(true));
    render(<MemoryRouter><Musicians /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'João' });
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais músicos' }));
    await waitFor(() => expect(fake.list).toHaveBeenLastCalledWith(expect.any(Object), { id: 'cursor' }));
    await choose('Filtrar por instrumento', 'Teclado');
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() => expect(fake.list).toHaveBeenLastCalledWith(expect.objectContaining({ instrument: '' }), null));
  });
  it('does not query or display third-party profiles offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<MemoryRouter><Musicians /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Conecte-se');
    expect(fake.list).not.toHaveBeenCalled(); expect(screen.queryByRole('heading', { name: 'João' })).toBeNull();
  });
});
