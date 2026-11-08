import { type MutableRefObject, useEffect, useRef, useState } from 'react';

type OsmdCursor = {
  show: () => void;
  hide: () => void;
  next: () => void;
  reset: () => void;
  cursorElement?: HTMLElement;
  Iterator: { EndReached: boolean; currentTimeStamp: { RealValue: number } };
};
type Sheet = { load: (xml: string) => Promise<unknown>; render: () => void; clear: () => void; cursor?: OsmdCursor };

/** The playback cursor of a drawn score: where each step starts (in whole notes) and a way to move onto one. */
export type ScoreCursor = { steps: number[]; moveTo: (index: number) => void; hide: () => void };

/** Walks the cursor once over the whole score to learn where every step starts. */
const readSteps = (cursor: OsmdCursor): number[] => {
  const steps: number[] = [];
  cursor.reset();
  while (!cursor.Iterator.EndReached) {
    steps.push(cursor.Iterator.currentTimeStamp.RealValue);
    cursor.next();
  }
  cursor.reset();
  return steps;
};

const makeCursor = (cursor: OsmdCursor, host: HTMLElement): ScoreCursor => {
  const steps = readSteps(cursor);
  let at = 0;
  let shown = false;
  return {
    steps,
    moveTo(index) {
      const target = Math.max(0, Math.min(index, steps.length - 1));
      if (!shown) {
        cursor.show();
        shown = true;
      }
      if (target < at) {
        cursor.reset();
        at = 0;
      }
      while (at < target) {
        cursor.next();
        at++;
      }
      // Keep the cursor in view inside the scrolling page (and the sheet's own horizontal scroll).
      const el = cursor.cursorElement;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const top = 140;
      if (box.top < top || box.bottom > window.innerHeight - 160) window.scrollBy({ top: box.top - top - 40, behavior: 'smooth' });
      const sheet = host.parentElement;
      if (sheet && (box.left < sheet.getBoundingClientRect().left || box.right > sheet.getBoundingClientRect().right)) el.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    },
    hide() {
      cursor.hide();
      shown = false;
    },
  };
};

/**
 * Draws MusicXML with OpenSheetMusicDisplay (BSD-3), loaded on demand. The score sits on a light
 * "paper" sheet in both themes, since engraving is black on transparent. OSMD's own autoResize adds a
 * window listener it never removes, so resizing is driven here by a ResizeObserver owned by this effect.
 */
export const ScoreView = ({ xml, cursorRef }: { xml: string; cursorRef?: MutableRefObject<ScoreCursor | null> }) => {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let sheet: Sheet | undefined;
    let observer: ResizeObserver | undefined;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        if (cancelled || !host.current) return;
        host.current.innerHTML = '';
        const view: Sheet = new OpenSheetMusicDisplay(host.current, {
          autoResize: false,
          backend: 'svg',
          drawTitle: true,
          drawComposer: true,
          drawPartNames: true,
          disableCursor: false,
          // The playback cursor: an emerald bar over the notes sounding now.
          cursorsOptions: [{ type: 0, color: '#10b981', alpha: 0.45, follow: false }],
        });
        sheet = view;
        await view.load(xml);
        if (cancelled) {
          view.clear();
          return;
        }
        view.render();
        const attach = () => {
          if (cursorRef && view.cursor && host.current) cursorRef.current = makeCursor(view.cursor, host.current);
        };
        attach();
        if (typeof ResizeObserver === 'function' && host.current) {
          let width = host.current.clientWidth;
          let frame = 0;
          observer = new ResizeObserver(([entry]) => {
            const next = Math.round(entry?.contentRect.width ?? 0);
            if (!next || Math.abs(next - width) < 8) return;
            width = next;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
              if (cancelled) return;
              view.render();
              attach(); // a new layout redraws the cursor; the player moves it back on its next tick
            });
          });
          observer.observe(host.current);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível desenhar a partitura.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (cursorRef) cursorRef.current = null;
      sheet?.clear();
    };
  }, [xml]);

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-white p-2 text-black shadow-sm">
      {loading && <div className="m-6 h-1 w-24 animate-pulse rounded-full bg-emerald-500/40" aria-label="Desenhando a partitura" />}
      {error && (
        <p className="m-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div ref={host} />
    </div>
  );
};
