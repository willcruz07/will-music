import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

/** A new route starts at the top; query-only filters and in-page interactions keep their position. */
export const RouteScrollReset = () => {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);
  useLayoutEffect(() => {
    let frame = 0;
    const top = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };
    const reset = () => {
      top();
      cancelAnimationFrame(frame);
      // Repeat after route effects/layout changes (e.g. the studio's sticky header on Safari).
      frame = requestAnimationFrame(top);
    };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) reset(); };
    reset();
    window.addEventListener('pageshow', onPageShow);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('pageshow', onPageShow); };
  }, [pathname]);
  return null;
};
