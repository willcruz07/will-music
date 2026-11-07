import { Check, ChevronDown, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SheetOption = { value: string; label: string; hint?: string; group?: string };

/**
 * A select that looks like a field and opens a bottom sheet (like iOS action sheets): the page behind
 * dims and blurs, the options are a list of large rows with the current one marked. Tap a row to
 * choose; Escape, the backdrop, the close button or a swipe down on the handle close without changing.
 * Every choice from a list in the app goes through this instead of a native <select>.
 */
export const SheetSelect = ({
  label,
  value,
  onChange,
  options,
  title,
  className = '',
  valueClassName = '',
  renderValue,
}: {
  /** Accessible name of the field and title of the sheet. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SheetOption[];
  /** Sheet title when it differs from the label. */
  title?: string;
  className?: string;
  valueClassName?: string;
  renderValue?: (option: SheetOption | undefined) => ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 min-w-0 max-w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-left text-sm hover:border-primary/60 ${className}`}
      >
        <span className={`truncate ${valueClassName}`}>{renderValue ? renderValue(current) : (current?.label ?? '—')}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <Sheet
          title={title ?? label}
          options={options}
          value={value}
          onClose={close}
          onPick={(v) => {
            if (v !== value) onChange(v);
            close();
          }}
        />
      )}
    </>
  );
};

const Sheet = ({ title, options, value, onClose, onPick }: { title: string; options: SheetOption[]; value: string; onClose: () => void; onPick: (v: string) => void }) => {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Lock the page behind, focus the chosen row, close on Escape and keep Tab inside the sheet.
  useEffect(() => {
    const body = document.body;
    const before = body.style.overflow;
    body.style.overflow = 'hidden';
    const chosen = list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLElement>('[role="option"]');
    chosen?.focus();
    chosen?.scrollIntoView?.({ block: 'center' });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>('button')];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      body.style.overflow = before;
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const onListKey = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
    items[next]?.focus();
  };

  // Swipe the handle down to close, like an iOS sheet.
  const onHandleDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (dragStart.current !== null) setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onHandleUp = () => {
    if (dragStart.current === null) return;
    dragStart.current = null;
    if (dragY > 80) onClose();
    else setDragY(0);
  };

  const groups: { name?: string; items: SheetOption[] }[] = [];
  for (const o of options) {
    const g = groups[groups.length - 1];
    if (g && g.name === o.group) g.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }

  const row = (o: SheetOption, i: number) => {
    const selected = o.value === value;
    const hintId = `${titleId}-h${i}`;
    return (
      <button
        key={o.value}
        type="button"
        role="option"
        aria-selected={selected}
        aria-describedby={o.hint ? hintId : undefined}
        onClick={() => onPick(o.value)}
        className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          selected ? 'border-primary/60 bg-primary/10 font-semibold' : 'border-transparent hover:bg-muted'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{o.label}</span>
          {o.hint && (
            <span id={hintId} aria-hidden className="block truncate text-xs font-normal text-muted-foreground">
              {o.hint}
            </span>
          )}
        </span>
        <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
          {selected && <Check className="size-3" strokeWidth={3} />}
        </span>
      </button>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div data-testid="sheet-backdrop" aria-hidden onClick={onClose} className="sheet-backdrop absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        className="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl border border-b-0 border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_48px_-12px_rgb(0_0_0/0.5)] transition-transform"
      >
        <div className="touch-none cursor-grab px-4 pt-2.5" onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}>
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/40" />
          <div className="flex items-center justify-between gap-2 py-2">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <button type="button" aria-label="Fechar" onClick={onClose} className="flex size-9 items-center justify-center rounded-full hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div ref={list} role="listbox" aria-labelledby={titleId} onKeyDown={onListKey} className="overflow-y-auto overscroll-contain px-3 pb-4">
          {groups.map((g, i) =>
            g.name ? (
              <div key={`${g.name}-${i}`} role="group" aria-label={g.name} className="mt-2 first:mt-0">
                <p aria-hidden className="px-4 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
                  {g.name}
                </p>
                {g.items.map(row)}
              </div>
            ) : (
              <div key={`g-${i}`} className="flex flex-col gap-0.5">
                {g.items.map(row)}
              </div>
            ),
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
