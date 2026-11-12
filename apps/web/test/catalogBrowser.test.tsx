import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/db.ts';
import { Library } from '../src/pages/Library.tsx';

vi.mock('../src/lib/account.ts', () => ({ useAccount: () => ({ user: null, ready: true, error: null }) }));
vi.mock('../src/components/About.tsx', () => ({ AboutButton: () => null }));
vi.mock('../src/lib/cloud/catalog.ts', () => ({ listCatalog: async () => ({ items: [{ id: 'integration-one', title: 'Canção do catálogo', artist: 'Artista', content: '[C]Minha canção', style: 'mpb' }], more: false, cursor: null }), listCatalogArtists: async () => ({ items: [{ name: 'Artista Um', slug: 'artista-um', photo: 'https://example.com/photo.jpg' }], more: false, cursor: null }), catalogError: () => 'Falha de consulta' }));
beforeEach(async () => { await db.songs.clear(); await db.charts.clear(); await db.audio.clear(); await db.scores.clear(); });

describe('catalog to local library', () => {
  it('shows the imported chart in Cifras immediately, without reloading the app', async () => {
    render(<MemoryRouter initialEntries={['/?aba=catalogo']}><Library /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar cifra' }));
    expect(await screen.findByRole('link', { name: /Na biblioteca/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Cifras' }));
    expect(await screen.findByRole('link', { name: 'Abrir cifra “Canção do catálogo”' })).toBeInTheDocument();
    expect(await db.charts.count()).toBe(1);
    expect(await db.audio.count()).toBe(0);
  });

  it('shows artist cards rather than song cards in artist mode', async () => {
    render(<MemoryRouter initialEntries={['/?aba=catalogo&por=artista']}><Library /></MemoryRouter>);
    const card = await screen.findByRole('link', { name: 'Ver cifras de Artista Um' });
    expect(card.getAttribute('href')).toContain('/catalogo/artista/slug%3Aartista-um');
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(screen.queryByRole('button', { name: 'Salvar cifra' })).toBeNull();
  });
});
