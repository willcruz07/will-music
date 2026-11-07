import { useEffect, useState } from 'react';
import type { ScrollMode } from '../components/Player.tsx';

const KEY = 'wm-scroll';

/** Scroll preference (follow the playing line, or a steady scroll at a chosen speed), remembered per device. */
export const useScrollPrefs = (): [{ mode: ScrollMode; speed: number }, (patch: Partial<{ mode: ScrollMode; speed: number }>) => void] => {
  const [prefs, setPrefs] = useState<{ mode: ScrollMode; speed: number }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { mode?: ScrollMode; speed?: number } | null;
      return { mode: saved?.mode === 'steady' ? 'steady' : 'follow', speed: Math.min(10, Math.max(1, saved?.speed ?? 3)) };
    } catch {
      return { mode: 'follow', speed: 3 };
    }
  });
  const update = (patch: Partial<{ mode: ScrollMode; speed: number }>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* per-device convenience only */
      }
      return next;
    });
  return [prefs, update];
};

/** Pixels per second for speed 1–10 (a slow read to a fast run-through). */
export const steadyPixelsPerSecond = (speed: number): number => 6 + (speed - 1) * 9;

/** Scrolls the page down at a steady speed while active; stops at the bottom. */
export const useSteadyScroll = (active: boolean, speed: number): void => {
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      carry += (steadyPixelsPerSecond(speed) * (now - last)) / 1000;
      last = now;
      const whole = Math.floor(carry);
      if (whole >= 1) {
        carry -= whole;
        window.scrollBy(0, whole);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, speed]);
};
