import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ uid: 'one', name: vi.fn(), save: vi.fn(), load: vi.fn() }));
vi.mock('../src/lib/account.ts', () => ({ getAccountState: () => ({ user: { uid: fake.uid, name: 'Will' } }), applyAccountDisplayName: fake.name }));
vi.mock('../src/lib/cloud/users.ts', () => ({ saveMusicianAccount: fake.save, loadMusicianAccount: fake.load }));
import { db } from '../src/lib/db.ts';
import { emptyMusicianProfile } from '../src/lib/musicianProfile.ts';
import { flushMusicianProfile, getCachedMusician, loadMusicianProfile, musicianProfileError, saveMusicianProfile, startMusicianProfileSync } from '../src/lib/musicianProfileStore.ts';
const details = (name: string) => ({ name, musicianProfile: emptyMusicianProfile() });
beforeEach(async () => {
  await db.settings.clear(); fake.uid = 'one'; fake.save.mockReset().mockResolvedValue(undefined); fake.load.mockReset(); fake.name.mockReset();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
});

describe('musician profile offline outbox', () => {
  it('explains nested storage refusals without claiming the draft was saved', () => {
    expect(musicianProfileError({ name: 'AbortError', code: 22, inner: { name: 'QuotaExceededError' } })).toContain('não permitiu guardar');
  });
  it('stores offline edits, restores them without network and sends them on reconnection', async () => {
    await saveMusicianProfile('one', details('Nome artístico'));
    expect(fake.save).not.toHaveBeenCalled();
    expect((await getCachedMusician('one'))?.pending).toBe(true);
    expect((await loadMusicianProfile('one')).account.name).toBe('Nome artístico');
    expect(fake.load).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await flushMusicianProfile('one');
    expect(fake.save).toHaveBeenCalledWith('one', expect.objectContaining({ name: 'Nome artístico' }));
    expect((await getCachedMusician('one'))?.pending).toBe(false);
    expect(await getCachedMusician('two')).toBeNull();
  });
  it('retains the draft when the server refuses the write', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fake.save.mockRejectedValueOnce(new Error('Servidor indisponível'));
    await expect(saveMusicianProfile('one', details('Rascunho'))).rejects.toThrow('Servidor indisponível');
    expect((await getCachedMusician('one'))?.account.name).toBe('Rascunho');
    expect((await getCachedMusician('one'))?.pending).toBe(true);
    await flushMusicianProfile('one'); expect((await getCachedMusician('one'))?.pending).toBe(false);
  });
  it('flushes pending edits when the browser reconnects', async () => {
    await saveMusicianProfile('one', details('Reconectado'));
    const stop = startMusicianProfileSync('one');
    try {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      window.dispatchEvent(new Event('online'));
      await vi.waitFor(async () => expect((await getCachedMusician('one'))?.pending).toBe(false));
      expect(fake.save).toHaveBeenCalledWith('one', expect.objectContaining({ name: 'Reconectado' }));
    } finally { stop(); }
  });
  it('does not clear a newer edit after confirming an older request', async () => {
    let finish!: () => void;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fake.save.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = saveMusicianProfile('one', details('Primeiro'));
    await vi.waitFor(() => expect(fake.save).toHaveBeenCalledTimes(1));
    const second = saveMusicianProfile('one', details('Segundo'));
    await vi.waitFor(async () => expect((await getCachedMusician('one'))?.account.name).toBe('Segundo'));
    finish(); await Promise.all([first, second]);
    expect(fake.save).toHaveBeenLastCalledWith('one', expect.objectContaining({ name: 'Segundo' }));
    expect((await getCachedMusician('one'))?.pending).toBe(false);
  });
  it('preserves a new local edit when an older server read completes', async () => {
    let finish!: (value: unknown) => void;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fake.load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const loading = loadMusicianProfile('one');
    await vi.waitFor(() => expect(fake.load).toHaveBeenCalled());
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await saveMusicianProfile('one', details('Edição nova'));
    finish({ ...details('Nome antigo'), contributions: 10 });
    expect((await loading).account.name).toBe('Edição nova');
    expect((await getCachedMusician('one'))?.pending).toBe(true);
  });
  it('does not save for a different signed-in UID', async () => {
    fake.uid = 'two';
    await expect(saveMusicianProfile('one', details('Não salvar'))).rejects.toThrow('conta mudou');
    expect(fake.save).not.toHaveBeenCalled(); expect(await getCachedMusician('one')).toBeNull();
  });
});
