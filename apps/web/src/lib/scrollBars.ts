import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Whether the bottom bar should be hidden after a scroll from `lastY` to `y`: hidden while scrolling
 * down, shown again when scrolling up, near the top, and at the end of the page. Small jitters (a few
 * pixels, iOS bounce) keep the current state.
 */
export const nextBarsHidden = (hidden: boolean, lastY: number, y: number, maxY: number): boolean => {
  if (y < 64) return false;
  if (y >= maxY - 4) return false;
  const delta = y - lastY;
  if (delta > 6) return true;
  if (delta < -6) return false;
  return hidden;
};

const PHONE = '(max-width: 767px)';

const setHidden = (hidden: boolean) => {
  if (hidden) document.documentElement.dataset.bars = 'hidden';
  else delete document.documentElement.dataset.bars;
};

/** On phones, slides the bottom bar away while reading down and back when scrolling up (shown again on every screen change). */
export const useAutoHideBars = (): void => {
  const { pathname } = useLocation();
  useEffect(() => setHidden(false), [pathname]);
  useEffect(() => {
    const phone = typeof matchMedia === 'function' ? matchMedia(PHONE) : null;
    let lastY = window.scrollY;
    let hidden = false;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const maxY = document.documentElement.scrollHeight - window.innerHeight;
        const next = phone?.matches ? nextBarsHidden(hidden, lastY, y, maxY) : false;
        if (next !== hidden) {
          hidden = next;
          setHidden(hidden);
        }
        lastY = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      setHidden(false);
    };
  }, []);
};
