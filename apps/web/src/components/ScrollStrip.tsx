import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

type More = 'none' | 'start' | 'end' | 'both';

/**
 * A row of options that scrolls sideways on narrow screens (tabs, chips, filters). The edge that still
 * hides options fades out, so it is clear there is more to swipe to; buttons snap into place, and the
 * chosen option is kept in view. Every horizontal strip of buttons in the app goes through this.
 */
export const ScrollStrip = ({
  children,
  label,
  role,
  selected,
  className = '',
  innerClassName = '',
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
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}) => {
  const strip = useRef<HTMLDivElement>(null);
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
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    const chosen = strip.current?.querySelector<HTMLElement>('[aria-selected="true"],[aria-checked="true"],[aria-pressed="true"]');
    chosen?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    measure();
  }, [selected, measure]);

  return (
    <div className={`relative -mx-4 ${className}`}>
      <div
        ref={strip}
        data-testid="scroll-strip"
        data-more={more}
        onScroll={measure}
        className="scroll-strip no-scrollbar snap-x snap-proximity overflow-x-auto scroll-px-4 px-4 py-0.5"
      >
        <div role={role} aria-label={label} onKeyDown={onKeyDown} className={`flex w-max gap-1 [&>*]:shrink-0 [&>*]:snap-start ${innerClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
};
