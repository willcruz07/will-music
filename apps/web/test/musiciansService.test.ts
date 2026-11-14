import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ uid: 'viewer', query: vi.fn(), get: vi.fn(), read: vi.fn(), data: [] as { id: string; data: () => unknown }[] }));
vi.mock('../src/lib/account.ts', () => ({ getAccountState: () => ({ user: { uid: fake.uid } }) }));
vi.mock('../src/lib/cloud/firebase.ts', () => ({ cloudApp: {}, cloudAuth: { get currentUser() { return { uid: fake.uid }; } } }));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}), collection: (_: unknown, path: string) => path,
  doc: (_: unknown, ...parts: string[]) => parts.join('/'),
  where: (field: string, operator: string, value: unknown) => ({ field, operator, value }),
  orderBy: (field: string) => ({ orderBy: field }), limit: (value: number) => ({ limit: value }), startAfter: (value: unknown) => ({ cursor: value }),
  query: fake.query, getDocFromServer: fake.read,
  getDocsFromServer: fake.get,
}));
import { getMusician, listMusicians } from '../src/lib/cloud/musicians.ts';
beforeEach(() => {
  fake.uid = 'viewer'; fake.query.mockClear(); fake.get.mockReset().mockImplementation(async () => ({ docs: fake.data, size: fake.data.length }));
  fake.read.mockReset().mockResolvedValue({ exists: () => false });
  fake.data = []; Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
describe('paginated musician queries', () => {
  it('combines region, city, instrument and style with a single array predicate and normalized name', async () => {
    await listMusicians({ region: 'SP', city: 'São Paulo', instrument: 'Teclado', style: 'Jazz', name: 'João' });
    const constraints = fake.query.mock.calls[0]!.slice(1);
    expect(fake.query.mock.calls[0]![0]).toBe('wmMusicians');
    expect(constraints).toEqual(expect.arrayContaining([{ field: 'location.country', operator: '==', value: 'Brasil' }, { field: 'location.region', operator: '==', value: 'SP' }, { field: 'location.city', operator: '==', value: 'São Paulo' }, { field: 'tags', operator: 'array-contains', value: 'is:Teclado|Jazz' }, { field: 'searchName', operator: '>=', value: 'joao' }, { orderBy: 'searchName' }, { limit: 20 }]));
    expect(constraints.filter(value => (value as { operator?: string }).operator === 'array-contains')).toHaveLength(1);
  });
  it('uses document cursors and bounded pages instead of downloading the collection', async () => {
    fake.data = Array.from({ length: 20 }, (_, index) => ({ id: String(index), data: () => ({ name: `Músico ${index}` }) }));
    const first = await listMusicians({}); expect(first.more).toBe(true); expect(first.items).toHaveLength(20);
    await listMusicians({}, first.cursor);
    expect(fake.query.mock.calls[1]).toContainEqual({ cursor: first.cursor });
    expect(first.items[0]?.uid).toBe('0');
  });
  it('does not consult private users or query while offline', async () => {
    expect(await getMusician('target')).toBeNull(); expect(fake.read).toHaveBeenCalledWith('wmMusicians/target');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); fake.get.mockClear();
    await expect(listMusicians({})).rejects.toThrow('Conecte-se'); expect(fake.get).not.toHaveBeenCalled();
  });
});
