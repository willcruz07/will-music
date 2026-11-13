import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const cloud = vi.hoisted(() => ({ data: new Map<string, Record<string, unknown>>(), user: { uid: 'owner', email: 'owner@example.com', name: 'Dono', photo: 'https://example.com/photo.jpg' } }));
vi.mock('../src/lib/account.ts', () => ({ getAccountState: () => ({ user: cloud.user }) }));
vi.mock('../src/lib/cloud/firebase.ts', () => ({ cloudApp: {}, cloudAuth: { get currentUser() { return cloud.user; } } }));
vi.mock('firebase/firestore', () => {
  const snapshot = (path: string) => ({ id: path.split('/').at(-1), exists: () => cloud.data.has(path), data: () => structuredClone(cloud.data.get(path)) });
  return {
    getFirestore: () => ({}), doc: (_db: unknown, ...parts: string[]) => parts.join('/'), collection: (_db: unknown, ...parts: string[]) => parts.join('/'),
    query: (path: string) => path, orderBy: () => ({}), where: () => ({}), onSnapshot: () => () => {}, writeBatch: () => ({}),
    getDocFromServer: async (path: string) => snapshot(path),
    getDocsFromServer: async (path: string) => { const keys = [...cloud.data.keys()].filter(key => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/')).sort(); return { docs: keys.map(snapshot), size: keys.length }; },
    runTransaction: async (_db: unknown, work: (tx: unknown) => unknown) => {
      const pending = new Map<string, Record<string, unknown>>();
      const result = await work({ get: async (path: string) => snapshot(path), set: (path: string, data: Record<string, unknown>) => pending.set(path, data), update: (path: string, data: Record<string, unknown>) => pending.set(path, { ...cloud.data.get(path), ...data }) });
      for (const [key, data] of pending) cloud.data.set(key, structuredClone(data));
      return result;
    },
  };
});
import { db, type Setlist } from '../src/lib/db.ts';
import { publishSetlist, restoreAcceptedSetlist, sendSetlistInvite, shareIdFor } from '../src/lib/cloud/sharing.ts';
import type { SetlistInvite } from '../src/lib/sharingTypes.ts';

const list: Setlist = { id: 'list', name: 'Ensaio', items: [{ id: 'item', songId: 'song' }], createdAt: '', updatedAt: '' };
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto); cloud.data.clear();
  cloud.user = { uid: 'owner', email: 'owner@example.com', name: 'Dono', photo: 'https://example.com/photo.jpg' };
  await Promise.all([db.charts.clear(), db.songs.clear(), db.sharedSetlists.clear()]);
  await db.songs.put({ id: 'song', title: 'Música', artist: 'Artista', durationSec: 0, favorite: false, analysisStatus: 'done', createdAt: '', updatedAt: '' });
  await db.charts.put({ id: 'chart', songId: 'song', chordPro: '[C]Letra', transpose: 0, fontSize: 18, origin: 'manual', createdAt: '', updatedAt: '' });
});
afterEach(() => vi.unstubAllGlobals());

describe('setlist publications and invitations', () => {
  it('reuses unchanged publications and preserves earlier versions on edits', async () => {
    const first = await publishSetlist(list);
    expect(first.version).toBe(1);
    expect((await publishSetlist(list)).version).toBe(1);
    const path = `wmShares/${first.shareId}/versions/1/items/000`;
    const original = structuredClone(cloud.data.get(path));
    await db.charts.update('chart', { chordPro: '[G]Outra letra' });
    expect((await publishSetlist(list)).version).toBe(2);
    expect(cloud.data.get(path)).toEqual(original);
    expect(original).toMatchObject({ chart: { chordPro: '[C]Letra' } });
  });
  it('sends a normalized private invitation with the owner photo, without forging acceptance', async () => {
    await sendSetlistInvite(list, ' Guest@Example.com ');
    const id = `${shareIdFor('owner', list.id)}__guest@example.com`;
    expect(cloud.data.get(`wmInvites/${id}`)).toMatchObject({ senderUid: 'owner', senderName: 'Dono', senderPhoto: cloud.user.photo, recipientEmail: 'guest@example.com', status: 'pending', acceptedVersion: 0 });
    await expect(sendSetlistInvite(list, cloud.user.email)).rejects.toThrow('outra pessoa');
  });
  it('restores the accepted version after refusing a later version, without changing the invitation', async () => {
    const first = await publishSetlist(list);
    await db.charts.update('chart', { chordPro: '[G]Nova letra' }); await publishSetlist(list);
    cloud.user = { uid: 'guest', email: 'guest@example.com', name: 'Convidado', photo: '' };
    const invitation: SetlistInvite = { id: 'invitation', shareId: first.shareId, senderUid: 'owner', senderName: 'Dono', senderPhoto: '', recipientEmail: cloud.user.email, recipientUid: 'guest', name: list.name, itemCount: 1, status: 'accepted', offeredVersion: 2, acceptedVersion: 1, declinedVersion: 2, updatedAt: '' };
    cloud.data.set('wmInvites/invitation', { ...invitation });
    await restoreAcceptedSetlist(invitation);
    const saved = await db.sharedSetlists.get(first.shareId);
    expect(saved?.version).toBe(1); expect(saved?.items[0]?.chart.chordPro).toBe('[C]Letra');
    expect(cloud.data.get('wmInvites/invitation')).toEqual(invitation);
  });
  it('rejects a new invitation when the recipient opted out', async () => {
    cloud.data.set('wmInvitePreferences/guest@example.com', { acceptsInvites: false });
    await expect(sendSetlistInvite(list, 'guest@example.com')).rejects.toThrow('não está recebendo');
    expect([...cloud.data.keys()].some(key => key.startsWith('wmInvites/'))).toBe(false);
  });
});
