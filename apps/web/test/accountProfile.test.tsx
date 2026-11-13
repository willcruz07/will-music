import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { AccountAvatar } from '../src/components/AccountAvatar.tsx';
import { loadMusicianAccount, saveAccountProfile, saveMusicianAccount } from '../src/lib/cloud/users.ts';
import { emptyMusicianProfile } from '../src/lib/musicianProfile.ts';

const fake = vi.hoisted(() => ({ auth: { currentUser: { uid: 'uid-one', email: 'will@example.com', displayName: 'Will Cruz', photoURL: 'https://example.com/google-photo.jpg' } }, stored: null as Record<string, unknown> | null, set: vi.fn(), update: vi.fn(), doc: vi.fn((...args: unknown[]) => args), transaction: vi.fn() }));
vi.mock('../src/lib/cloud/firebase.ts', () => ({ cloudApp: {}, cloudAuth: fake.auth }));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => 'database', doc: fake.doc, serverTimestamp: () => 'server-time',
  getDocFromServer: async () => ({ exists: () => fake.stored !== null, data: () => fake.stored }),
  runTransaction: async (_: unknown, action: (tx: unknown) => unknown) => {
    fake.transaction();
    return action({ get: async () => ({ exists: () => fake.stored !== null, data: () => fake.stored }), set: fake.set, update: fake.update });
  },
}));
const googleUser = { uid: 'uid-one', displayName: 'Will Cruz', email: 'will@example.com', photoURL: 'https://example.com/google-photo.jpg' } as User;
beforeEach(() => { fake.auth.currentUser = { uid: 'uid-one', email: 'will@example.com', displayName: 'Will Cruz', photoURL: 'https://example.com/google-photo.jpg' }; fake.stored = null; fake.set.mockClear(); fake.update.mockClear(); fake.doc.mockClear(); fake.transaction.mockClear(); });

describe('users collection reconciliation', () => {
  it('creates the canonical UID document with Google data and server timestamps', async () => {
    const profile = await saveAccountProfile(googleUser);
    expect(fake.doc).toHaveBeenCalledWith('database', 'users', 'uid-one');
    expect(fake.set.mock.calls[0]![1]).toMatchObject({ name: 'Will Cruz', email: 'will@example.com', photoURL: googleUser.photoURL, createdAt: 'server-time', updatedAt: 'server-time', lastAuth: 'server-time', notification: [] });
    expect(profile.photo).toBe(googleUser.photoURL);
    expect(fake.update).not.toHaveBeenCalled();
  });

  it('preserves custom name, photo, creation date, preferences, notifications and privileged fields', async () => {
    fake.stored = { name: 'Nome do Alt7', photoURL: 'https://example.com/custom.jpg', createdAt: 'old', preferences: { pushEnabled: false }, notification: ['invite'], owner: true, isUserPremium: true };
    const profile = await saveAccountProfile(googleUser);
    expect(profile.name).toBe('Nome do Alt7');
    expect(profile.photo).toBe('https://example.com/custom.jpg');
    expect(fake.set).toHaveBeenCalledTimes(1);
    expect(fake.set).toHaveBeenCalledWith(['database', 'wmInvitePreferences', 'will@example.com'], { acceptsInvites: false });
    expect(fake.update.mock.calls[0]![1]).toEqual({ email: 'will@example.com', lastAuth: 'server-time', updatedAt: 'server-time' });
  });

  it('fills missing profile fields and rejects a write for a different session UID', async () => {
    fake.stored = { name: '', photoURL: '' };
    await saveAccountProfile(googleUser);
    expect(fake.update.mock.calls[0]![1]).toMatchObject({ name: 'Will Cruz', photoURL: googleUser.photoURL });
    fake.auth.currentUser.uid = 'someone-else'; fake.transaction.mockClear();
    await expect(saveAccountProfile(googleUser)).rejects.toThrow(/sessão mudou/);
    expect(fake.transaction).not.toHaveBeenCalled();
  });
});

describe('private musician profile writes', () => {
  it('updates only name and musical details, preserving roles and contribution counters', async () => {
    fake.stored = { name: 'Anterior', owner: true, isUserPremium: true, willMusicStats: { contributions: 12 }, preferences: { pushEnabled: false } };
    const profile = { ...emptyMusicianProfile(), nickname: 'Will', instruments: ['Teclado'], styles: ['Jazz'], acceptsInvites: true };
    await saveMusicianAccount('uid-one', { name: 'Wellen', musicianProfile: profile });
    expect(fake.update).toHaveBeenCalledWith(['database', 'users', 'uid-one'], { name: 'Wellen', musicianProfile: profile, updatedAt: 'server-time' });
    expect(fake.set).toHaveBeenCalledWith(['database', 'wmInvitePreferences', 'will@example.com'], { acceptsInvites: true });
    expect(fake.stored.willMusicStats).toEqual({ contributions: 12 });
  });
  it('loads musical data and confirmed counters without exposing other accounts', async () => {
    fake.stored = { name: 'Wellen', musicianProfile: { nickname: 'Will', styles: ['Gospel'] }, willMusicStats: { contributions: 7 } };
    expect(await loadMusicianAccount('uid-one')).toMatchObject({ name: 'Wellen', musicianProfile: { nickname: 'Will', styles: ['Gospel'], acceptsInvites: false }, contributions: 7 });
    await expect(loadMusicianAccount('different')).rejects.toThrow('sessão mudou');
  });
  it('preserves musical choices when reconciling a subsequent Google login', async () => {
    fake.stored = { name: 'Nome artístico', musicianProfile: { ...emptyMusicianProfile(), acceptsInvites: true } };
    await saveAccountProfile(googleUser);
    expect(fake.update.mock.calls[0]![1]).not.toHaveProperty('musicianProfile');
    expect(fake.update.mock.calls[0]![1]).not.toHaveProperty('name');
    expect(fake.set).toHaveBeenCalledWith(['database', 'wmInvitePreferences', 'will@example.com'], { acceptsInvites: true });
  });
});

describe('account avatar', () => {
  it('shows a photo, falls back on failure, and can use a new photo afterward', () => {
    const user = { uid: 'uid-one', name: 'Will Cruz', email: 'will@example.com', photo: 'https://example.com/a.jpg' };
    const { container, rerender } = render(<AccountAvatar user={user} />);
    expect(container.querySelector('img')).toHaveAttribute('src', user.photo);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByText('WC')).toBeInTheDocument();
    rerender(<AccountAvatar user={{ ...user, photo: 'https://example.com/b.jpg' }} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/b.jpg');
  });

  it('uses initials when the account has no photo', () => {
    render(<AccountAvatar user={{ uid: 'uid-one', name: 'Will Cruz', email: '', photo: null }} />);
    expect(screen.getByText('WC')).toBeInTheDocument();
  });
});
