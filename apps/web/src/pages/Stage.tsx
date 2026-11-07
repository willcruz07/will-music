import { ChevronLeft, ChevronRight, Minus, Pause, Play, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChartView } from '../components/ChartView.tsx';
import { type Chart, type Setlist, type Song, db } from '../lib/db.ts';
import { resolveItems, updateSetlist } from '../lib/setlists.ts';
import { semitonesTo, stageAction } from '../lib/stage.ts';
import { transposeKey } from '../lib/transpose.ts';
import { applyThemePref, paintBrowserBar } from '../lib/theme.ts';
import { useWakeLock } from '../lib/wakeLock.ts';

const FONT_KEY = 'wm-stage-font';
const readFont = () => {
  try {
    return Number(localStorage.getItem(FONT_KEY)) || 28;
  } catch {
    return 28;
  }
};

type Entry = { index: number; song: Song; chart?: Chart; targetKey?: string };

/** Stage mode: large, dark, offline, screen kept on; pedals and swipes move through the list. */
export const Stage = ({ mode = 'list' }: { mode?: 'list' | 'song' }) => {
  const { id = '' } = useParams();
  const single = mode === 'song';
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [pos, setPos] = useState(0);
  const [fontSize, setFontSize] = useState(readFont);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(3);
  const touchX = useRef<number | null>(null);

  useWakeLock(true);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    paintBrowserBar(true);
    // On exit, re-apply the saved preference instead of a class snapshot.
    return () => applyThemePref();
  }, []);

  useEffect(() => {
    void (async () => {
      const list: Setlist | undefined = single
        ? { id: '', name: '', items: [{ songId: id }], createdAt: '', updatedAt: '' }
        : await db.setlists.get(id);
      if (!list) {
        setEntries([]);
        return;
      }
      setSetlist(single ? null : list);
      const resolved = await resolveItems(list);
      setEntries(resolved.flatMap((r, index) => (r.song ? [{ index, song: r.song, chart: r.chart, targetKey: r.item.targetKey }] : [])));
    })();
  }, [id, single]);

  const entry = entries?.[pos];
  const originalKey = entry?.song.key ? transposeKey(entry.song.key, entry.chart?.transpose ?? 0) : undefined;
  const shownKey = entry?.targetKey ?? originalKey;
  const transpose = useMemo(() => (entry?.song.key && shownKey ? semitonesTo(entry.song.key, shownKey) : (entry?.chart?.transpose ?? 0)), [entry, shownKey]);

  // Read through a ref: a pedal press right after the list loads must not use a stale (empty) list.
  const countRef = useRef(0);
  countRef.current = entries?.length ?? 0;
  const go = useCallback((delta: number) => {
    setScrolling(false);
    setPos((p) => Math.min(Math.max(0, p + delta), Math.max(0, countRef.current - 1)));
    window.scrollTo?.({ top: 0 });
  }, []);

  const changeKey = (delta: number) => {
    if (!entry || !shownKey) return;
    const next = transposeKey(shownKey, delta);
    setEntries((list) => list?.map((e, i) => (i === pos ? { ...e, targetKey: next } : e)) ?? null);
    if (setlist) {
      const items = setlist.items.map((it, i) => (i === entry.index ? { ...it, targetKey: next } : it));
      setSetlist({ ...setlist, items });
      void updateSetlist(setlist.id, { items });
    }
  };

  const changeFont = (delta: number) => {
    const next = Math.min(64, Math.max(16, fontSize + delta));
    setFontSize(next);
    try {
      localStorage.setItem(FONT_KEY, String(next));
    } catch {
      // storage unavailable
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLInputElement | null;
      const action = stageAction({ key: e.key, code: e.code, targetTag: target?.tagName, targetType: target?.type });
      if (!action) return;
      e.preventDefault();
      if (action === 'next') go(1);
      else if (action === 'prev') go(-1);
      else window.scrollBy?.({ top: (action === 'scroll-down' ? 1 : -1) * window.innerHeight * 0.6, behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  useEffect(() => {
    if (!scrolling) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      window.scrollBy?.(0, ((now - last) / 1000) * speed * 12);
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scrolling, speed]);

  const exitTo = setlist ? `/listas/${setlist.id}` : `/musica/${id}`;

  if (entries === null) return null;
  if (!entry) {
    return (
      <main className="min-h-dvh bg-background p-6 text-foreground">
        <p className="text-xl">Nenhuma música para tocar.</p>
        <Link to={exitTo} className="mt-4 inline-block text-chord underline">
          Voltar
        </Link>
      </main>
    );
  }

  const nextEntry = entries[pos + 1];
  return (
    <main
      className="min-h-dvh bg-background pb-28 text-foreground"
      onTouchStart={(e) => {
        // Dragging the controls (speed slider, footer) must not count as a swipe.
        const fromControls = (e.target as HTMLElement).closest('footer, header, input');
        touchX.current = fromControls ? null : (e.touches[0]?.clientX ?? null);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined && Math.abs(end - start) > 70) go(end < start ? 1 : -1);
        touchX.current = null;
      }}
    >
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <Link to={exitTo} aria-label="Sair do palco" className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-muted">
          <X className="size-5" />
        </Link>
        {entries.length > 1 && <span className="tabular-nums text-muted-foreground">{`${pos + 1} de ${entries.length}`}</span>}
        <h1 className="min-w-[8rem] flex-1 truncate text-xl font-bold">{entry.song.title}</h1>
        {shownKey && (
          <span className="flex items-center gap-1">
            <button type="button" aria-label="Meio tom abaixo" onClick={() => changeKey(-1)} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-muted">
              <Minus className="size-4" />
            </button>
            <span className="min-w-10 text-center text-2xl font-bold text-chord">{shownKey}</span>
            <button type="button" aria-label="Meio tom acima" onClick={() => changeKey(1)} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-muted">
              <Plus className="size-4" />
            </button>
          </span>
        )}
        {entry.song.capo ? <span className="text-muted-foreground">Capo {entry.song.capo}</span> : null}
        <button type="button" aria-label="Diminuir letra" onClick={() => changeFont(-2)} className="rounded-lg px-2 py-2 font-bold hover:bg-muted">
          A−
        </button>
        <button type="button" aria-label="Aumentar letra" onClick={() => changeFont(2)} className="rounded-lg px-2 py-2 text-lg font-bold hover:bg-muted">
          A+
        </button>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6">
        {entry.chart ? (
          <ChartView chordPro={entry.chart.chordPro} transpose={transpose} preferFlats={false} spellKey={shownKey} fontSize={fontSize} />
        ) : (
          <p className="text-xl text-muted-foreground">Esta música ainda não tem cifra.</p>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 flex items-center gap-2 border-t border-border bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => go(-1)} disabled={pos === 0} aria-label="Música anterior" className="inline-flex min-h-12 shrink-0 items-center gap-1 rounded-lg px-2 disabled:opacity-30 sm:px-3">
          <ChevronLeft className="size-6" /> <span className="hidden sm:inline">Anterior</span>
        </button>
        <span className="flex min-w-0 flex-1 items-center justify-center gap-3">
          <button
            type="button"
            aria-pressed={scrolling}
            aria-label={scrolling ? 'Parar rolagem' : 'Rolar automaticamente'}
            onClick={() => setScrolling((s) => !s)}
            className="inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            {scrolling ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
          </button>
          <input type="range" min={1} max={10} value={speed} aria-label="Velocidade da rolagem" onChange={(e) => setSpeed(Number(e.target.value))} className="w-28 min-w-0 shrink accent-[var(--primary)]" />
        </span>
        <button type="button" onClick={() => go(1)} disabled={!nextEntry} aria-label="Próxima música" className="inline-flex min-h-12 shrink-0 items-center gap-1 rounded-lg px-2 text-right disabled:opacity-30 sm:px-3">
          <span className="hidden max-w-40 truncate sm:inline">{nextEntry ? nextEntry.song.title : 'Fim da lista'}</span> <span className="hidden sm:inline">Próxima</span> <ChevronRight className="size-6" />
        </button>
      </footer>
    </main>
  );
};
