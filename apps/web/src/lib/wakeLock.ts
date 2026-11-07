import { useEffect } from 'react';

type Sentinel = { release: () => Promise<void> };
type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> };

/** Keeps the screen on while `active`; asks again when the tab becomes visible (browsers drop the lock on hide). */
export const useWakeLock = (active: boolean): void => {
  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!active || !api) return;
    let sentinel: Sentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      try {
        const s = await api.request('screen');
        if (stopped) void s.release();
        else sentinel = s;
      } catch {
        // permission denied or not allowed right now; the stage still works
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
};
