import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

const fake = vi.hoisted(() => ({ auth: { currentUser: null as User | null }, listener: null as null | ((user: User | null) => void), prepare: vi.fn(), popup: vi.fn(), token: vi.fn(), logout: vi.fn(), profile: vi.fn() }));
vi.mock('../src/lib/cloud/firebase.ts', () => ({ cloudAuth: fake.auth, ensureCloudSession: fake.prepare }));
vi.mock('../src/lib/cloud/users.ts', () => ({ saveAccountProfile: fake.profile }));
vi.mock('firebase/auth', () => ({
  onIdTokenChanged: (_: unknown, listener: (user: User | null) => void) => { fake.listener = listener; return vi.fn(); },
  signInWithPopup: fake.popup, getIdTokenResult: fake.token, signOut: fake.logout,
  GoogleAuthProvider: class { setCustomParameters() {} },
}));
const user = (providers = ['google.com']) => ({ uid: 'google-user', displayName: 'Musicista', email: 'music@example.com', photoURL: null, providerData: providers.map(providerId => ({ providerId })) }) as User;

beforeEach(() => {
  vi.resetModules(); fake.auth.currentUser = null; fake.listener = null;
  fake.prepare.mockReset().mockResolvedValue(undefined); fake.popup.mockReset(); fake.token.mockReset().mockResolvedValue({ signInProvider: 'google.com' }); fake.logout.mockReset().mockImplementation(async () => { fake.auth.currentUser = null; });
  fake.profile.mockReset().mockResolvedValue({ name: 'Musicista', email: 'music@example.com', photo: null });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});

describe('SDK session and application state stay synchronized', () => {
  it('publishes a successful popup immediately, even before the observer delivers its callback', async () => {
    const account = await import('../src/lib/account.ts');
    await account.startAccount();
    expect(account.getAccountState().user).toBeNull();
    fake.popup.mockImplementation(async () => { fake.auth.currentUser = user(); return { user: fake.auth.currentUser }; });
    const login = await account.prepareGoogle();
    await login();
    expect(account.hasGoogleSession(account.getAccountState().user)).toBe(true);
    // An older initial callback must not send the application back to /login.
    fake.listener!(null);
    await vi.waitFor(() => expect(account.hasGoogleSession(account.getAccountState().user)).toBe(true));
  });

  it('waits for restoration before marking the session ready after a page reload', async () => {
    let restored!: () => void;
    fake.prepare.mockReturnValue(new Promise<void>(resolve => { restored = resolve; }));
    const account = await import('../src/lib/account.ts');
    const start = account.startAccount();
    await vi.waitFor(() => expect(fake.prepare).toHaveBeenCalled());
    expect(account.getAccountState().ready).toBe(false);
    fake.auth.currentUser = user(); restored(); await start;
    expect(account.getAccountState()).toMatchObject({ ready: true, user: { uid: 'google-user' } });
  });

  it('uses the SDK token provider when the restored profile has incomplete provider metadata', async () => {
    fake.auth.currentUser = user([]);
    const account = await import('../src/lib/account.ts');
    await account.startAccount();
    expect(fake.token).toHaveBeenCalledWith(fake.auth.currentUser);
    expect(account.hasGoogleSession(account.getAccountState().user)).toBe(true);
  });

  it('does not infer Google access for a password-only session', async () => {
    fake.auth.currentUser = user(['password']); fake.token.mockResolvedValue({ signInProvider: 'password' });
    const account = await import('../src/lib/account.ts');
    await account.startAccount();
    expect(account.hasGoogleSession(account.getAccountState().user)).toBe(false);
  });

  it('clears the account on logout and ignores a late token lookup from an older session', async () => {
    let token!: (value: { signInProvider: string }) => void;
    fake.auth.currentUser = user();
    const account = await import('../src/lib/account.ts');
    await account.startAccount();
    fake.auth.currentUser = user([]);
    fake.token.mockReturnValue(new Promise(resolve => { token = resolve; }));
    fake.listener!(fake.auth.currentUser);
    await vi.waitFor(() => expect(fake.token).toHaveBeenCalled());
    await account.leaveAccount(); token({ signInProvider: 'google.com' });
    await Promise.resolve();
    expect(account.getAccountState()).toMatchObject({ ready: true, user: null });
  });

  it('saves the profile once across repeated token notifications and applies its custom photo', async () => {
    fake.auth.currentUser = user();
    fake.profile.mockResolvedValue({ name: 'Nome personalizado', email: 'music@example.com', photo: 'https://example.com/avatar.jpg' });
    const account = await import('../src/lib/account.ts');
    await account.startAccount();
    await vi.waitFor(() => expect(account.getAccountState().profileStatus).toBe('synced'));
    fake.listener!(fake.auth.currentUser); fake.listener!(fake.auth.currentUser);
    await Promise.resolve();
    expect(fake.profile).toHaveBeenCalledTimes(1);
    expect(account.getAccountState().user).toMatchObject({ name: 'Nome personalizado', photo: 'https://example.com/avatar.jpg' });
  });

  it('keeps Google access when profile writes fail and supports retry', async () => {
    fake.auth.currentUser = user(); fake.profile.mockRejectedValueOnce({ code: 'permission-denied' });
    const account = await import('../src/lib/account.ts');
    await account.startAccount();
    await vi.waitFor(() => expect(account.getAccountState().profileStatus).toBe('error'));
    expect(account.hasGoogleSession(account.getAccountState().user)).toBe(true);
    expect(account.getAccountState().profileError).toMatch(/permissões de users/);
    await account.retryAccountProfile();
    expect(account.getAccountState().profileStatus).toBe('synced');
  });
});
