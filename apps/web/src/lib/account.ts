import { useEffect, useSyncExternalStore } from 'react';
import type { User } from 'firebase/auth';
import type { AccountProfile } from './cloud/users.ts';

export type AccountUser = { uid: string; name: string; email: string; photo: string | null; providers?: string[] };
export const hasGoogleSession = (user: AccountUser | null): boolean => !!user?.providers?.includes('google.com');
type AccountState = { user: AccountUser | null; ready: boolean; error: string | null; profileStatus?: 'pending' | 'synced' | 'offline' | 'error'; profileError?: string | null };
let state: AccountState = { user: null, ready: false, error: null };
const listeners = new Set<() => void>();
const emit = (next: AccountState) => { state = next; listeners.forEach(fn => fn()); };
let initializing: Promise<void> | undefined;
let unsubscribe: (() => void) | undefined;
let revision = 0;
let profileEpoch = 0;
let savedProfile: { uid: string; profile: AccountProfile } | null = null;
let profileRequest: { uid: string; epoch: number; promise: Promise<void> } | null = null;
let watchingConnection = false;

const syncProfile = (user: User): Promise<void> => {
  if (savedProfile?.uid === user.uid) return Promise.resolve();
  const epoch = profileEpoch;
  if (profileRequest?.uid === user.uid && profileRequest.epoch === epoch) return profileRequest.promise;
  if (!navigator.onLine) { emit({ ...state, profileStatus: 'offline', profileError: null }); return Promise.resolve(); }
  emit({ ...state, profileStatus: 'pending', profileError: null });
  const request = (async () => {
    try {
      const { saveAccountProfile } = await import('./cloud/users.ts');
      if (epoch !== profileEpoch || state.user?.uid !== user.uid) return;
      const profile = await saveAccountProfile(user);
      if (epoch !== profileEpoch || state.user?.uid !== user.uid) return;
      savedProfile = { uid: user.uid, profile };
      emit({ ...state, user: { ...state.user, ...profile }, profileStatus: 'synced', profileError: null });
    } catch (error) {
      if (epoch !== profileEpoch || state.user?.uid !== user.uid) return;
      const code = (error as { code?: string } | null)?.code;
      const message = code === 'permission-denied' || code === 'firestore/permission-denied'
        ? 'O servidor não permitiu salvar seu perfil. As permissões de users precisam autorizar o seu UID.'
        : 'Não foi possível sincronizar seu perfil agora. Sua sessão continua ativa; você pode tentar novamente.';
      emit({ ...state, profileStatus: navigator.onLine ? 'error' : 'offline', profileError: message });
    } finally { if (profileRequest?.uid === user.uid && profileRequest.epoch === epoch) profileRequest = null; }
  })();
  profileRequest = { uid: user.uid, epoch, promise: request };
  return request;
};

export const retryAccountProfile = async () => {
  const { cloudAuth } = await import('./cloud/firebase.ts');
  const user = cloudAuth.currentUser;
  if (user && user.uid === state.user?.uid && hasGoogleSession(state.user)) { savedProfile = null; await syncProfile(user); }
};

export const accountError = (error: unknown): string => {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
    'auth/invalid-email': 'Informe um endereço de e-mail válido.',
    'auth/user-disabled': 'Esta conta está desativada. Entre em contato com o suporte.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.',
    'auth/network-request-failed': 'Não foi possível conectar. Verifique sua internet e tente novamente.',
    'auth/web-storage-unsupported': 'O navegador recusou guardar a sessão. Permita o armazenamento deste site e tente novamente. Não é necessário apagar suas músicas.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Permita popups para este site e tente novamente. No PWA, você também pode tentar abrir o app no navegador.',
    'auth/popup-closed-by-user': 'A entrada com Google foi cancelada.',
    'auth/cancelled-popup-request': 'A entrada anterior foi cancelada. Tente novamente.',
    'auth/unauthorized-domain': 'Este endereço do aplicativo ainda precisa ser autorizado no Firebase Authentication.',
    'auth/operation-not-allowed': 'Esta forma de entrada ainda não está habilitada no Firebase.',
    'auth/account-exists-with-different-credential': 'Use a forma de entrada já vinculada a este e-mail.',
    'auth/user-not-found': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
    'auth/wrong-password': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  };
  return (code && messages[code]) || 'Não foi possível acessar sua conta agora. Tente novamente.';
};

const syncAccount = async (user: User | null) => {
  const ticket = ++revision;
  if (!user) { profileEpoch++; savedProfile = null; emit({ ready: true, error: null, user: null }); return; }
  const providers = user.providerData.map(provider => provider.providerId);
  // The signed-in provider is also present in Firebase's token, even when profile metadata is incomplete.
  if (!providers.includes('google.com')) {
    try { const { getIdTokenResult } = await import('firebase/auth'); const token = await getIdTokenResult(user); if (token.signInProvider === 'google.com') providers.push('google.com'); }
    catch { /* Preserve the SDK profile; never infer a Google login from a local flag. */ }
  }
  if (ticket !== revision) return;
  const profile = savedProfile?.uid === user.uid ? savedProfile.profile : null;
  if (state.user && state.user.uid !== user.uid) { profileEpoch++; savedProfile = null; }
  const sameUser = state.user?.uid === user.uid;
  emit({ ready: true, error: null, user: { uid: user.uid, name: profile?.name || user.displayName || '', email: user.email || profile?.email || '', photo: profile?.photo || user.photoURL, providers }, profileStatus: profile ? 'synced' : sameUser ? state.profileStatus : undefined, profileError: sameUser ? state.profileError : null });
  if (hasGoogleSession(state.user)) void syncProfile(user);
};

export const startAccount = (): Promise<void> => initializing ??= (async () => {
  try {
    const [{ cloudAuth, ensureCloudSession }, { onIdTokenChanged }] = await Promise.all([import('./cloud/firebase.ts'), import('firebase/auth')]);
    await ensureCloudSession();
    if (!watchingConnection) { watchingConnection = true; window.addEventListener('online', () => { if (!savedProfile) void retryAccountProfile(); }); }
    unsubscribe?.();
    unsubscribe = onIdTokenChanged(cloudAuth, () => {
      // Read the current SDK user: a queued callback can contain an older user/null value.
      void syncAccount(cloudAuth.currentUser);
    }, error => { emit({ ...state, ready: true, error: accountError(error) }); initializing = undefined; });
    await syncAccount(cloudAuth.currentUser);
  } catch (error) { emit({ ...state, ready: true, error: accountError(error) }); initializing = undefined; }
})();

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getAccountState = (): AccountState => state;
export const useAccount = () => {
  const snapshot = useSyncExternalStore(subscribe, getAccountState, getAccountState);
  useEffect(() => { void startAccount(); }, []);
  return snapshot;
};
const online = () => { if (!navigator.onLine) throw { code: 'auth/network-request-failed' }; };
/** Load before enabling the Google button, so the popup opens in the user's click gesture. */
export const prepareGoogle = async () => {
  const [{ cloudAuth, ensureCloudSession }, { signInWithPopup, GoogleAuthProvider }] = await Promise.all([import('./cloud/firebase.ts'), import('firebase/auth')]);
  await ensureCloudSession();
  return async () => {
    online(); const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(cloudAuth, provider);
    await syncAccount(cloudAuth.currentUser ?? result.user);
    return result;
  };
};
export const leaveAccount = async () => {
  const [{ cloudAuth }, { signOut }] = await Promise.all([import('./cloud/firebase.ts'), import('firebase/auth')]);
  await signOut(cloudAuth);
  revision++;
  profileEpoch++;
  savedProfile = null;
  emit({ ready: true, user: null, error: null });
};
