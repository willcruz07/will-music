import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ ready: vi.fn(), set: vi.fn(), initialize: vi.fn(), auth: {} as { authStateReady: () => Promise<void> } }));
vi.mock('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  browserLocalPersistence: 'local', indexedDBLocalPersistence: 'indexedDB', browserSessionPersistence: 'session', inMemoryPersistence: 'memory', browserPopupRedirectResolver: {},
  initializeAuth: (...args: unknown[]) => { fake.initialize(...args); return fake.auth; }, getAuth: () => fake.auth, setPersistence: fake.set,
}));

beforeEach(() => { vi.resetModules(); fake.ready.mockReset().mockResolvedValue(undefined); fake.set.mockReset().mockResolvedValue(undefined); fake.initialize.mockClear(); fake.auth = { authStateReady: fake.ready }; });

describe('durable Firebase session setup', () => {
  it('restores the SDK before selecting local persistence and shares concurrent preparations', async () => {
    let restored!: () => void;
    fake.ready.mockReturnValue(new Promise<void>(resolve => { restored = resolve; }));
    const { ensureCloudSession } = await import('../src/lib/cloud/firebase.ts');
    const first = ensureCloudSession(); const second = ensureCloudSession();
    expect(fake.set).not.toHaveBeenCalled();
    restored(); await Promise.all([first, second]);
    expect(fake.initialize.mock.calls[0]![1].persistence[0]).toBe('local');
    expect(fake.set).toHaveBeenCalledExactlyOnceWith(fake.auth, 'local');
  });

  it('falls back to IndexedDB only if local storage is refused', async () => {
    fake.set.mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValue(undefined);
    const { ensureCloudSession } = await import('../src/lib/cloud/firebase.ts');
    await ensureCloudSession();
    expect(fake.set.mock.calls.map(args => args[1])).toEqual(['local', 'indexedDB']);
  });

  it('reports refused durable storage instead of silently promising a remembered login, and permits retry', async () => {
    fake.set.mockRejectedValue(new Error('storage refused'));
    const { ensureCloudSession } = await import('../src/lib/cloud/firebase.ts');
    await expect(ensureCloudSession()).rejects.toMatchObject({ code: 'auth/web-storage-unsupported' });
    fake.set.mockResolvedValue(undefined);
    await expect(ensureCloudSession()).resolves.toBeUndefined();
  });
});
