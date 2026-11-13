import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { createLibraryDatabase, db, type Chart, type Song } from '../src/lib/db.ts';
import { checkedPersonalChart, checkedSetlist, invitationNeedsAction, normalizeInviteEmail, personalChart, stableWire, type SetlistInvite, type SharedSetlist } from '../src/lib/sharingTypes.ts';
import { Stage } from '../src/pages/Stage.tsx';

const song: Song = { id: 'original', title: 'Canção recebida', artist: 'Artista', key: 'C', durationSec: 240, favorite: false, analysisStatus: 'done', createdAt: '', updatedAt: '' };
const chart: Chart = { id: 'local-id', songId: song.id, chordPro: '[C]Uma letra', transpose: 0, fontSize: 18, origin: 'manual', createdAt: '', updatedAt: '' };
const invite = { status: 'accepted', offeredVersion: 2, acceptedVersion: 1, declinedVersion: 0 } as SetlistInvite;
afterEach(async () => { await db.sharedSetlists.clear(); await db.settings.delete('wm-shared-reading:received'); });

describe('sharing data boundaries', () => {
  it('normalizes emails and rejects paths/invalid addresses', () => {
    expect(normalizeInviteEmail(' Will@Example.com ')).toBe('will@example.com');
    for (const invalid of ['x/y@example.com', 'abc', 'a@b', 'a b@example.com']) expect(() => normalizeInviteEmail(invalid)).toThrow();
  });
  it('notifies only pending invitations or newer versions not already refused', () => {
    expect(invitationNeedsAction(invite)).toBe(true);
    expect(invitationNeedsAction({ ...invite, declinedVersion: 2 })).toBe(false);
    expect(invitationNeedsAction({ ...invite, acceptedVersion: 2 })).toBe(false);
    expect(invitationNeedsAction({ ...invite, status: 'declined' })).toBe(false);
    expect(invitationNeedsAction({ ...invite, status: 'pending' })).toBe(true);
  });
  it('sends text/settings only, with a canonical chart ID across devices', () => {
    const first = personalChart({ ...song, durationSec: 500 }, chart);
    const second = personalChart(song, { ...chart, id: 'other-device-id' });
    expect(stableWire(first)).toBe(stableWire(second));
    expect(first.song.durationSec).toBe(0);
    expect(first.chart.id).toBe('original-chart');
    expect(checkedPersonalChart(first)).toEqual(first);
    expect(() => checkedPersonalChart({ ...first, chart: { ...first.chart, chordShapes: { C: { instrument: 'invalid', variant: 0 } } } })).toThrow();
    expect(() => checkedSetlist({ id: 'x', name: 'X', items: [{ songId: 'y', transpose: 'invalid' }] })).toThrow();
  });
  it('keeps databases isolated between accounts, including shared versions', async () => {
    const a = createLibraryDatabase('test-account-a'); const b = createLibraryDatabase('test-account-b');
    try {
      await a.songs.put(song); await a.settings.put({ key: 'private', value: 'A' });
      expect(await b.songs.get(song.id)).toBeUndefined();
      expect(await b.settings.get('private')).toBeUndefined();
      expect(await b.sharedSetlists.count()).toBe(0);
    } finally { await a.delete(); await b.delete(); }
  });
});

describe('shared offline stage', () => {
  it('reads the snapshot without personal songs, keeps transpose personal and restores it', async () => {
    const snapshot: SharedSetlist = { id: 'received', inviteId: 'invitation', ownerUid: 'owner', ownerName: 'Músico', ownerPhoto: '', name: 'Domingo compartilhado', version: 1, items: [{ id: 'stable-item', order: 0, song, chart }], updatedAt: '' };
    await db.sharedSetlists.put(snapshot);
    const view = () => <MemoryRouter initialEntries={['/palco/compartilhada/received']}><Routes><Route path="/palco/compartilhada/:id" element={<Stage mode="shared" />} /></Routes></MemoryRouter>;
    const first = render(view());
    expect(await screen.findByRole('heading', { name: song.title })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Meio tom acima' }));
    await waitFor(async () => expect((await db.settings.get('wm-shared-reading:received'))?.value).toEqual({ 'stable-item': { targetKey: 'C#', transpose: undefined } }));
    expect(await db.sharedSetlists.get(snapshot.id)).toEqual(snapshot);
    expect(await db.songs.get(song.id)).toBeUndefined();
    expect(screen.getByRole('link', { name: 'Sair do palco' })).toHaveAttribute('href', '/palco');
    first.unmount(); render(view());
    expect(await screen.findByLabelText('Tom C#')).toBeInTheDocument();
  });
});
