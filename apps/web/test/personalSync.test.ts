import { webcrypto } from 'node:crypto';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const cloud = vi.hoisted(() => ({ data: new Map<string, Record<string, unknown>>(), user: { uid: 'account-a', email: 'a@example.com', name: 'A', photo: '' } as { uid: string; email: string; name: string; photo: string } | null }));
vi.mock('../src/lib/account.ts', () => ({ getAccountState: () => ({ user: cloud.user }) }));
vi.mock('../src/lib/cloud/firebase.ts', () => ({ cloudApp: {}, cloudAuth: { get currentUser() { return cloud.user; } } }));
vi.mock('firebase/firestore', () => {
  const snapshot = (path: string) => ({ exists: () => cloud.data.has(path), data: () => cloud.data.get(path) });
  return {
    getFirestore: () => ({}),
    collection: (_db: unknown, ...parts: string[]) => parts.join('/'),
    doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
    onSnapshot: () => () => {},
    getDocsFromServer: async (path: string) => ({ docs: [...cloud.data].filter(([key]) => key.startsWith(path + '/')).map(([key, data]) => ({ id: key.slice(path.length + 1), data: () => structuredClone(data) })) }),
    runTransaction: async (_db: unknown, work: (tx: unknown) => unknown) => work({ get: async (path: string) => snapshot(path), set: (path: string, data: Record<string, unknown>) => cloud.data.set(path, structuredClone(data)) }),
  };
});
import { db, type Chart, type Song } from '../src/lib/db.ts';
import { startPersonalSync } from '../src/lib/cloud/personalSync.ts';
import { personalChart } from '../src/lib/sharingTypes.ts';

const song: Song = { id: 'chart', title: 'Canção', artist: 'Artista', durationSec: 0, favorite: false, analysisStatus: 'done', createdAt: '', updatedAt: '' };
const chart: Chart = { id: 'chart-id', songId: 'chart', chordPro: '[C]Letra', transpose: 0, fontSize: 18, origin: 'manual', createdAt: '', updatedAt: '' };
const path = 'users/account-a/wmCharts/chart';
let stop = () => {};
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  cloud.data.clear(); cloud.user = { uid: 'account-a', email: 'a@example.com', name: 'A', photo: '' };
  await Promise.all([db.songs.clear(), db.charts.clear(), db.audio.clear(), db.setlists.clear(), db.settings.clear()]);
});
afterEach(() => { stop(); vi.unstubAllGlobals(); });

describe('personal library reconciliation', () => {
  it('uploads independent charts, excludes audio and syncs deletion as a tombstone', async () => {
    await db.songs.bulkPut([song, { ...song, id: 'audio-song' }]);
    await db.charts.bulkPut([chart, { ...chart, id: 'audio-chart', songId: 'audio-song' }]);
    await db.audio.put({ songId: 'audio-song', blob: new Blob(['audio']), mimeType: 'audio/mpeg' });
    stop = startPersonalSync(cloud.user!);
    await waitFor(() => expect(cloud.data.get(path)?.revision).toBe(1));
    await waitFor(async () => expect((await db.settings.get('wm-cloud-receipts'))?.value).toBeTruthy());
    expect(cloud.data.has('users/account-a/wmCharts/audio-song')).toBe(false);
    await db.transaction('rw', db.songs, db.charts, async () => { await db.songs.delete(song.id); await db.charts.delete(chart.id); });
    await waitFor(() => expect(cloud.data.get(path)).toMatchObject({ revision: 2, deleted: true, payload: null }), { timeout: 5000 });
  });
  it('preserves a simultaneous local edit and applies the remote version atomically', async () => {
    await db.songs.put(song); await db.charts.put(chart);
    cloud.data.set(path, { revision: 1, deleted: false, payload: personalChart(song, chart) });
    stop = startPersonalSync(cloud.user!);
    await waitFor(async () => expect((await db.settings.get('wm-cloud-receipts'))?.value).toBeTruthy());
    stop();
    await db.charts.update(chart.id, { chordPro: '[D]Edição local' });
    cloud.data.set(path, { revision: 2, deleted: false, payload: personalChart(song, { ...chart, chordPro: '[G]Edição remota' }) });
    stop = startPersonalSync(cloud.user!);
    await waitFor(async () => expect((await db.charts.get(chart.id))?.chordPro).toBe('[G]Edição remota'));
    const copies = (await db.songs.toArray()).filter(item => item.id !== song.id);
    expect(copies).toHaveLength(1);
    expect(copies[0]!.title).toContain('cópia deste aparelho');
    expect((await db.charts.where('songId').equals(copies[0]!.id).first())?.chordPro).toBe('[D]Edição local');
  });
  it('does not sync under a different authenticated account', async () => {
    await db.songs.put(song); await db.charts.put(chart);
    const previous = cloud.user!; cloud.user = { ...previous, uid: 'other' };
    stop = startPersonalSync(previous);
    expect(cloud.data.size).toBe(0);
  });
});
