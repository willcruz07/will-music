import { useEffect, useRef } from 'react';

/** Native interpretation of React Bits' Animated Content; no GSAP dependency.
 * Content stays visible if animation APIs are absent or motion is reduced. */
export const useCardReveal = (revision: string) => {
  const ref = useRef<HTMLUListElement>(null);
  const seen = useRef(new WeakSet<Element>());
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof matchMedia !== 'function') return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || typeof IntersectionObserver === 'undefined') return;
    const running = new Set<Animation>();
    let sequence = 0;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (seen.current.has(entry.target)) continue;
        seen.current.add(entry.target);
        if (typeof entry.target.animate !== 'function' || preference.matches) continue;
        const animation = entry.target.animate([
          { opacity: 0.35, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 280, delay: Math.min(sequence++ % 6 * 30, 120), easing: 'cubic-bezier(.2,.7,.3,1)' });
        running.add(animation);
        void animation.finished.then(() => running.delete(animation), () => running.delete(animation));
      }
    }, { threshold: 0.08 });
    for (const child of root.children) {
      if (child.getAttribute('aria-hidden') !== 'true' && !seen.current.has(child)) observer.observe(child);
    }
    const stop = () => {
      observer.disconnect();
      for (const animation of running) animation.cancel();
      running.clear();
    };
    const onPreferenceChange = () => { if (preference.matches) stop(); };
    preference.addEventListener('change', onPreferenceChange);
    return () => { stop(); preference.removeEventListener('change', onPreferenceChange); };
  }, [revision]);
  return ref;
};
