import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ getDocs: vi.fn(), getDoc: vi.fn(), query: vi.fn((...args: unknown[]) => args) }));
vi.mock('../src/lib/cloud/firebase.ts', () => ({ cloudApp: {} }));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}), collection: (_: unknown, name: string) => name, doc: (_: unknown, collection: string, id: string) => [collection, id],
  documentId: () => '__name__', orderBy: (field: string) => ['orderBy', field], limit: (size: number) => ['limit', size],
  where: (field: string, op: string, value: string) => ['where', field, op, value],
  startAt: (term: string) => ['startAt', term], endAt: (term: string) => ['endAt', term], startAfter: (cursor: unknown) => ['startAfter', cursor],
  query: fake.query, getDocsFromServer: fake.getDocs, getDocFromServer: fake.getDoc,
}));

beforeEach(() => { vi.resetModules(); fake.getDocs.mockReset(); fake.getDoc.mockReset(); fake.query.mockClear(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });

describe('bounded catalog queries', () => {
  it('preserves the original Firebase diagnostic and index link in the console', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const error = Object.assign(new Error('The query requires an index. Create it here: https://console.firebase.google.com/example'), { code: 'failed-precondition' });
      const { catalogError } = await import('../src/lib/cloud/catalog.ts');
      expect(catalogError(error)).toContain('índice');
      expect(log).toHaveBeenCalledWith('Falha ao consultar o catálogo do Firebase', error);
    } finally { log.mockRestore(); }
  });
  it('uses prefix constraints and a document cursor without downloading the whole collection', async () => {
    const docs = Array.from({ length: 24 }, (_, i) => ({ id: `doc-${i}`, data: () => ({ title: `Canção ${i}`, content: '[C]Letra' }) }));
    fake.getDocs.mockResolvedValueOnce({ docs, size: 24 }).mockResolvedValueOnce({ docs: [], size: 0 });
    const { listCatalog } = await import('../src/lib/cloud/catalog.ts');
    const first = await listCatalog('title', 'Canção');
    expect(first.more).toBe(true);
    expect(fake.query.mock.calls[0]).toEqual(['cifras', ['orderBy', 'title'], ['orderBy', '__name__'], ['startAt', 'Canção'], ['endAt', 'Canção\uf8ff'], ['limit', 24]]);
    await listCatalog('title', 'Canção', first.cursor);
    expect(fake.query.mock.calls[1]).toContainEqual(['startAfter', docs[23]]);
    expect(fake.query.mock.calls[1]).toContainEqual(['endAt', 'Canção\uf8ff']);
    await listCatalog('title', 'Canção');
    expect(fake.getDocs).toHaveBeenCalledTimes(2);
  });

  it('does not silently replace an artist search when permissions or indexes fail', async () => {
    fake.getDocs.mockRejectedValue({ code: 'permission-denied' });
    const { listCatalog, catalogError } = await import('../src/lib/cloud/catalog.ts');
    await expect(listCatalog('artist', 'Maria')).rejects.toMatchObject({ code: 'permission-denied' });
    expect(fake.query.mock.calls[0]).toContainEqual(['orderBy', 'artist.name']);
    expect(fake.getDocs).toHaveBeenCalledTimes(1);
    expect(catalogError({ code: 'failed-precondition' })).toMatch(/índice/);
    expect(catalogError({ code: 'permission-denied' })).toMatch(/não autorizou/);
  });

  it('does not query the server while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const { listCatalog } = await import('../src/lib/cloud/catalog.ts');
    await expect(listCatalog('title', '')).rejects.toThrow(/offline/);
    expect(fake.getDocs).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('groups artists with their photos and skips the whole last artist when loading another page', async () => {
    const docs = Array.from({ length: 24 }, (_, i) => ({ id: `artist-${i}`, data: () => ({ title: `Música ${i}`, artist: { name: 'Artista Um', slug: 'artista-um', photo: 'https://example.com/artist.jpg' } }) }));
    fake.getDocs.mockResolvedValueOnce({ docs, size: 24 }).mockResolvedValueOnce({ docs: [], size: 0 });
    const { listCatalogArtists } = await import('../src/lib/cloud/catalog.ts');
    const page = await listCatalogArtists('Artista');
    expect(page.items).toEqual([{ name: 'Artista Um', slug: 'artista-um', photo: 'https://example.com/artist.jpg' }]);
    expect(page.cursor).toBe('Artista Um');
    await listCatalogArtists('Artista', page.cursor);
    expect(fake.query.mock.calls[1]).toContainEqual(['startAfter', 'Artista Um']);
    expect(fake.query.mock.calls[1]).toContainEqual(['limit', 24]);
  });

  it('keeps an artist filter on every page and during title search', async () => {
    const docs = [{ id: 'one', data: () => ({ title: 'Canção', artist: { name: 'Artista Um', slug: 'artista-um' }, content: '[C]Letra' }) }];
    fake.getDocs.mockResolvedValue({ docs, size: 1 });
    const { listCatalog } = await import('../src/lib/cloud/catalog.ts');
    const artist = { name: 'Artista Um', slug: 'artista-um', photo: '' };
    const first = await listCatalog('title', 'Can', null, artist);
    await listCatalog('title', 'Can', first.cursor, artist);
    for (const call of fake.query.mock.calls) {
      expect(call).toContainEqual(['where', 'artist.slug', '==', 'artista-um']);
      expect(call).toContainEqual(['endAt', 'Can\uf8ff']);
    }
    await listCatalog('title', '', null, { ...artist, slug: '' });
    expect(fake.query.mock.calls[2]).toContainEqual(['where', 'artist.name', '==', 'Artista Um']);
  });
});
