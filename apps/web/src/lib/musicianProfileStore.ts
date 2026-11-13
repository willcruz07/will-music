import { applyAccountDisplayName, getAccountState } from './account.ts';
import { db, type LibraryDatabase } from './db.ts';
import { emptyMusicianProfile, validateMusicianDetails, type MusicianAccount, type MusicianDetails } from './musicianProfile.ts';
import { isQuotaError } from './storage.ts';

const KEY = 'wm-musician-profile';
export const MUSICIAN_PROFILE_CHANGED = 'wm-musician-profile-changed';
export type CachedMusician = { uid: string; account: MusicianAccount; revision: string; pending: boolean };
export const musicianProfileError = (error: unknown): string => {
  if (isQuotaError(error)) return 'O navegador não permitiu guardar o perfil neste aparelho. Verifique o armazenamento e tente novamente.';
  const rawCode = (error as { code?: unknown })?.code;
  const code = typeof rawCode === 'string' ? rawCode : '';
  if (code.includes('permission-denied')) return 'O perfil ficou guardado neste aparelho, mas o servidor não autorizou o envio. As regras de perfil e de preferência de convites precisam estar configuradas no Firebase.';
  if (code.includes('unavailable') || code.includes('network-request-failed')) return 'Não foi possível conectar ao servidor. O perfil continua guardado neste aparelho para tentar novamente.';
  return error instanceof Error ? error.message : 'Não foi possível salvar agora. Tente novamente.';
};
const changed = () => window.dispatchEvent(new Event(MUSICIAN_PROFILE_CHANGED));
const assertAccount = (uid: string) => { if (getAccountState().user?.uid !== uid) throw new Error('A conta mudou durante a operação.'); };
const cached = async (local: LibraryDatabase, uid: string): Promise<CachedMusician | null> => {
  const value = (await local.settings.get(KEY))?.value as CachedMusician | undefined;
  return value?.uid === uid ? value : null;
};
export const getCachedMusician = (uid: string) => cached(db, uid);
const flights = new Map<string, Promise<void>>();
export const flushMusicianProfile = (uid: string): Promise<void> => {
  const existing = flights.get(uid); if (existing) return existing;
  const local = db;
  const promise = (async () => {
    while (navigator.onLine) {
      assertAccount(uid); const value = await cached(local, uid);
      if (!value?.pending) return;
      const { saveMusicianAccount } = await import('./cloud/users.ts');
      assertAccount(uid); await saveMusicianAccount(uid, value.account); assertAccount(uid);
      // Another edit may have been made while the request was in flight.
      await local.transaction('rw', local.settings, async () => {
        const latest = await cached(local, uid); assertAccount(uid);
        if (latest?.revision === value.revision) await local.settings.put({ key: KEY, value: { ...latest, pending: false } });
      });
      changed();
    }
  })().finally(() => { if (flights.get(uid) === promise) flights.delete(uid); });
  flights.set(uid, promise); return promise;
};
export const saveMusicianProfile = async (uid: string, input: MusicianDetails): Promise<void> => {
  const local = db; assertAccount(uid); const details = validateMusicianDetails(input);
  const previous = await cached(local, uid); assertAccount(uid);
  const value: CachedMusician = { uid, revision: crypto.randomUUID(), pending: true, account: { ...details, contributions: previous?.account.contributions ?? null } };
  await local.settings.put({ key: KEY, value }); assertAccount(uid);
  applyAccountDisplayName(uid, details.name); changed();
  await flushMusicianProfile(uid);
  if (navigator.onLine && (await cached(local, uid))?.pending) await flushMusicianProfile(uid);
};
export const loadMusicianProfile = async (uid: string): Promise<CachedMusician> => {
  const local = db; assertAccount(uid); const previous = await cached(local, uid);
  if (previous?.pending) { applyAccountDisplayName(uid, previous.account.name); return previous; }
  if (!navigator.onLine) {
    if (previous) { applyAccountDisplayName(uid, previous.account.name); return previous; }
    return { uid, revision: '', pending: false, account: { name: getAccountState().user?.name || '', musicianProfile: emptyMusicianProfile(), contributions: null } };
  }
  const { loadMusicianAccount } = await import('./cloud/users.ts');
  const account = await loadMusicianAccount(uid); assertAccount(uid);
  let result: CachedMusician;
  await local.transaction('rw', local.settings, async () => {
    const latest = await cached(local, uid); assertAccount(uid);
    result = latest && latest.revision !== previous?.revision ? latest : { uid, account, revision: crypto.randomUUID(), pending: false };
    await local.settings.put({ key: KEY, value: result });
  });
  applyAccountDisplayName(uid, result!.account.name); changed(); return result!;
};
export const startMusicianProfileSync = (uid: string): (() => void) => {
  let active = true;
  const flush = () => { if (active && getAccountState().user?.uid === uid) void flushMusicianProfile(uid).catch(error => { if (active) { console.warn('Perfil musical pendente de sincronização', error); changed(); } }); };
  void getCachedMusician(uid).then(value => { if (active && value?.pending) { applyAccountDisplayName(uid, value.account.name); flush(); } }).catch(() => {});
  window.addEventListener('online', flush);
  return () => { active = false; window.removeEventListener('online', flush); };
};
