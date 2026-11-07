import { useEffect, useRef, useState } from 'react';

type Sheet = { load: (xml: string) => Promise<unknown>; render: () => void; clear: () => void };

/**
 * Draws MusicXML with OpenSheetMusicDisplay (BSD-3), loaded on demand. The score sits on a light
 * "paper" sheet in both themes, since engraving is black on transparent. OSMD's own autoResize adds a
 * window listener it never removes, so resizing is driven here by a ResizeObserver owned by this effect.
 */
export const ScoreView = ({ xml }: { xml: string }) => {
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
        const view: Sheet = new OpenSheetMusicDisplay(host.current, { autoResize: false, backend: 'svg', drawTitle: true, drawComposer: true, drawPartNames: true });
        sheet = view;
        await view.load(xml);
        if (cancelled) {
          view.clear();
          return;
        }
        view.render();
        if (typeof ResizeObserver === 'function' && host.current) {
          let width = host.current.clientWidth;
          let frame = 0;
          observer = new ResizeObserver(([entry]) => {
            const next = Math.round(entry?.contentRect.width ?? 0);
            if (!next || Math.abs(next - width) < 8) return;
            width = next;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => !cancelled && view.render());
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
