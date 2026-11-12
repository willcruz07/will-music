import { getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, browserPopupRedirectResolver, browserSessionPersistence, getAuth, indexedDBLocalPersistence, initializeAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { firebaseConfig } from './config.ts';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
};
export const cloudApp = getApps().find(app => app.name === 'will-music-catalog') ?? initializeApp(config, 'will-music-catalog');
export const cloudAuth = (() => {
  try {
    return initializeAuth(cloudApp, {
      persistence: [browserLocalPersistence, indexedDBLocalPersistence, browserSessionPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/already-initialized') return getAuth(cloudApp);
    throw error;
  }
})();

let prepared: Promise<void> | undefined;
/** Restore first and finish durable storage selection before allowing a new sign-in. */
export const ensureCloudSession = (): Promise<void> => prepared ??= (async () => {
  await cloudAuth.authStateReady();
  try { await setPersistence(cloudAuth, browserLocalPersistence); }
  catch {
    try { await setPersistence(cloudAuth, indexedDBLocalPersistence); }
    catch { throw Object.assign(new Error('Não foi possível manter a sessão neste navegador.'), { code: 'auth/web-storage-unsupported' }); }
  }
})().catch(error => { prepared = undefined; throw error; });
