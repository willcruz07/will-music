import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/db.ts';
import { Library } from '../src/pages/Library.tsx';

vi.mock('../src/lib/account.ts', () => ({ useAccount: () => ({ user: null, ready: true, error: null }) }));
vi.mock('../src/components/About.tsx', () => ({ AboutButton: () => null }));
vi.mock('../src/lib/cloud/catalog.ts', () => ({
  listCatalog: async () => ({ items: [{ id: 'integration-one', title: 'Canção do catálogo', artist: 'Artista', artistRef: { name: 'Artista', slug: 'artista', photo: 'https://example.com/photo.jpg' }, chordPro: '[C]Minha canção', style: 'mpb', key: 'C' }], more: false, cursor: null }),
  listCatalogArtists: async () => ({ items: [{ name: 'Artista Um', slug: 'artista-um', photo: 'https://example.com/photo.jpg' }], more: false, cursor: null }),
  countCatalogArtist: async () => 42,
  listCatalogStyles: async () => ({ items: ['gospel', 'mpb'], more: false, cursor: 'mpb' }),
  catalogError: () => 'Falha de consulta',
}));
beforeEach(async () => { await db.songs.clear(); await db.charts.clear(); await db.audio.clear(); await db.scores.clear(); });

describe('compact catalog', () => {
  it('opens a compact chart row with artist photo and no banner or save button', async () => {
    render(<MemoryRouter initialEntries={['/?aba=catalogo']}><Library /></MemoryRouter>);
    const row = await screen.findByRole('link', { name: /Canção do catálogo/ });
    expect(row.querySelector('img')).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(row).toHaveTextContent('Tom C');
    expect(screen.queryByText('Encontre sua próxima cifra')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar cifra' })).toBeNull();
    expect(await db.charts.count()).toBe(0);
  });

  it('shows artist rows with their exact server count', async () => {
    render(<MemoryRouter initialEntries={['/?aba=catalogo&por=artista']}><Library /></MemoryRouter>);
    const row = await screen.findByRole('link', { name: 'Ver cifras de Artista Um' });
    expect(row.getAttribute('href')).toContain('/catalogo/artista/slug%3Aartista-um');
    expect(row.querySelector('img')).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(await screen.findByText('42 cifras')).toBeInTheDocument();
  });

  it('applies sheet filters to the return URL and clears them without opening a result', async () => {
    render(<MemoryRouter initialEntries={['/?aba=catalogo']}><Library /></MemoryRouter>);
    await screen.findByRole('link', { name: /Canção do catálogo/ });
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filtrar catálogo' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Começa com C' }));
    fireEvent.click(await within(sheet).findByRole('button', { name: 'mpb' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Z–A' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Aplicar filtros' }));
    const row = await screen.findByRole('link', { name: /Canção do catálogo/ });
    const back = new URL(row.getAttribute('href')!, 'https://example.com').searchParams.get('voltar')!;
    expect(back).toContain('letra=C'); expect(back).toContain('estilo=mpb'); expect(back).toContain('ordem=za');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByRole('button', { name: 'Filtros' })).toBeInTheDocument();
  });
});
