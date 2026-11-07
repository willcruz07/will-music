import { useSyncExternalStore } from 'react';
import { requestPersistence } from './storage.ts';

/** Service-worker state shared between main.tsx (which registers it) and the banner. */
type PwaState = { needRefresh: boolean; offlineReady: boolean; update?: () => Promise<void> };

let state: PwaState = { needRefresh: false, offlineReady: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

export const notifyNeedRefresh = (update: () => Promise<void>): void => set({ needRefresh: true, update });
export const notifyOfflineReady = (): void => set({ offlineReady: true });
export const dismissPwaNotice = (): void => set({ needRefresh: false, offlineReady: false });
export const resetPwaState = (): void => {
  state = { needRefresh: false, offlineReady: false };
  installEvent = null;
  for (const l of listeners) l();
};

export const usePwaState = (): PwaState =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

/** The deferred `beforeinstallprompt` event (Chrome, Edge, Android). */
export type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let installEvent: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    for (const l of installListeners) l();
  });
  window.addEventListener('appinstalled', () => {
    // Installed apps get their data kept by the browser: ask right away.
    void requestPersistence();
    installEvent = null;
    for (const l of installListeners) l();
  });
}

export const useInstallPrompt = (): { canInstall: boolean; install: () => Promise<void> } => {
  const event = useSyncExternalStore(
    (l) => {
      installListeners.add(l);
      return () => installListeners.delete(l);
    },
    () => installEvent,
  );
  return {
    canInstall: !!event,
    install: async () => {
      if (!event) return;
      await event.prompt();
      await event.userChoice.catch(() => undefined);
      installEvent = null;
      for (const l of installListeners) l();
    },
  };
};

/** iPhone/iPad Safari has no install prompt: the user adds it from the Share menu. */
export const isIosBrowser = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone;
};

const DISMISS_KEY = 'wm-install-dismissed';
export const installDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};
export const dismissInstall = (): void => {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* per-device convenience only */
  }
};

export const isStandalone = (): boolean =>
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
