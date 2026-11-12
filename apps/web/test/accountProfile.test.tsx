import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { AccountAvatar } from '../src/components/AccountAvatar.tsx';
import { saveAccountProfile } from '../src/lib/cloud/users.ts';

const fake = vi.hoisted(() => ({ auth: { currentUser: { uid: 'uid-one' } }, stored: null as Record<string, unknown> | null, set: vi.fn(), update: vi.fn(), doc: vi.fn((...args: unknown[]) => args), transaction: vi.fn() }));
vi.mock('../src/lib/cloud/firebase.ts', () => ({ cloudApp: {}, cloudAuth: fake.auth }));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => 'database', doc: fake.doc, serverTimestamp: () => 'server-time',
  runTransaction: async (_: unknown, action: (tx: unknown) => unknown) => {
    fake.transaction();
    return action({ get: async () => ({ exists: () => fake.stored !== null, data: () => fake.stored }), set: fake.set, update: fake.update });
  },
}));
const googleUser = { uid: 'uid-one', displayName: 'Will Cruz', email: 'will@example.com', photoURL: 'https://example.com/google-photo.jpg' } as User;
beforeEach(() => { fake.auth.currentUser = { uid: 'uid-one' }; fake.stored = null; fake.set.mockClear(); fake.update.mockClear(); fake.doc.mockClear(); fake.transaction.mockClear(); });

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
    expect(fake.set).not.toHaveBeenCalled();
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
