import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

type More = 'none' | 'start' | 'end' | 'both';

/**
 * A row of options that scrolls sideways on narrow screens (tabs, chips, filters). The edge that still
 * hides options fades out, so it is clear there is more to swipe to; buttons snap into place, and the
 * chosen option is kept in view. Every option can be reached without a swipe too: arrows on the
 * hidden sides, the mouse wheel and mouse drag all move the row. Every horizontal strip of buttons
 * in the app goes through this.
 */
export const ScrollStrip = ({
  children,
  label,
  role,
  selected,
  className = '',
  innerClassName = '',
  stripClassName = '',
  onKeyDown,
}: {
  children: ReactNode;
  label?: string;
  /** "tablist" / "radiogroup" / "group" for the row itself. */
  role?: string;
  /** Changes when the chosen option changes (to bring it into view). */
  selected?: unknown;
  className?: string;
  innerClassName?: string;
  /** Extra classes for the scrolling element itself (e.g. to stop scrolling and wrap on desktop). */
  stripClassName?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}) => {
  const strip = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [more, setMore] = useState<More>('none');

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const start = el.scrollLeft > 2;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setMore(start && end ? 'both' : start ? 'start' : end ? 'end' : 'none');
  }, []);

  useEffect(() => {
    measure();
    const el = strip.current;
    if (!el || typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (row.current) ro.observe(row.current);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const chosen = strip.current?.querySelector<HTMLElement>('[aria-selected="true"],[aria-checked="true"],[aria-pressed="true"]');
    chosen?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    measure();
  }, [selected, measure]);

  // Vertical wheel → sideways, only while the row can still move that way (the page scrolls otherwise).
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth + 2) return;
      const atStart = el.scrollLeft <= 2 && e.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollBy({ left: e.deltaY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const page = (dir: 1 | -1) => {
    const el = strip.current;
    el?.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag.current = { x: e.clientX, left: strip.current?.scrollLeft ?? 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = strip.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 4) d.moved = true;
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    // A drag must not also press the button it ended on.
    const el = strip.current;
    if (!d?.moved || !el) return;
    const swallow = (ev: Event) => ev.stopPropagation();
    el.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => el.removeEventListener('click', swallow, { capture: true }), 0);
  };

  const arrow = 'absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-md backdrop-blur';

  return (
    <div className={`relative -mx-4 ${className}`}>
      {(more === 'start' || more === 'both') && (
        <button type="button" tabIndex={-1} aria-label="Ver opções anteriores" onClick={() => page(-1)} className={`${arrow} left-1`}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      {(more === 'end' || more === 'both') && (
        <button type="button" tabIndex={-1} aria-label="Ver mais opções" onClick={() => page(1)} className={`${arrow} right-1`}>
          <ChevronRight className="size-4" />
        </button>
      )}
      <div
        ref={strip}
        data-testid="scroll-strip"
        data-more={more}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        className={`scroll-strip no-scrollbar snap-x snap-proximity overflow-x-auto scroll-px-4 px-4 py-0.5 ${stripClassName}`}
      >
        <div ref={row} role={role} aria-label={label} onKeyDown={onKeyDown} className={`flex w-max gap-1 [&>*]:shrink-0 [&>*]:snap-start ${innerClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
};
