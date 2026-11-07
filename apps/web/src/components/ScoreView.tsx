import { useEffect, useRef, useState } from 'react';

/**
 * Draws MusicXML with OpenSheetMusicDisplay (BSD-3), loaded on demand. The score sits on a light
 * "paper" sheet in both themes, since engraving is black on transparent.
 */
export const ScoreView = ({ xml }: { xml: string }) => {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let osmd: { clear: () => void } | undefined;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
        if (cancelled || !host.current) return;
        host.current.innerHTML = '';
        const view = new OpenSheetMusicDisplay(host.current, { autoResize: true, backend: 'svg', drawTitle: true, drawComposer: true, drawPartNames: true });
        osmd = view;
        await view.load(xml);
        if (cancelled) return;
        view.render();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível desenhar a partitura.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      osmd?.clear();
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
