import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A modal bottom sheet (like iOS sheets): the page behind dims and blurs and stops scrolling, focus stays
 * inside, and Escape, the backdrop, the close button or a swipe down on the handle close it.
 * `initialFocus` picks the element focused on open (defaults to the first control).
 */
export const BottomSheet = ({
  title,
  onClose,
  children,
  initialFocus,
  hideTitle = false,
  panelClassName = '',
}: {
  title: string;
  onClose: () => void;
  children: (titleId: string) => ReactNode;
  initialFocus?: (panel: HTMLElement) => HTMLElement | null | undefined;
  /** Keep the title for screen readers only (the content shows its own heading). */
  hideTitle?: boolean;
  panelClassName?: string;
}) => {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const focusRef = useRef(initialFocus);

  useEffect(() => {
    const body = document.body;
    const before = body.style.overflow;
    body.style.overflow = 'hidden';
    const p = panel.current;
    if (p) {
      const target = focusRef.current?.(p) ?? p.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
      target?.scrollIntoView?.({ block: 'center' });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      } else if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
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

  const onHandleDown = (e: React.PointerEvent) => {
    // A press on the close button is a tap, not a drag: capturing the pointer would send its click to the handle instead.
    if ((e.target as HTMLElement).closest('button')) return;
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

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div data-testid="sheet-backdrop" aria-hidden onClick={onClose} className="sheet-backdrop absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        className={`sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl border border-b-0 border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_48px_-12px_rgb(0_0_0/0.5)] transition-transform ${panelClassName}`}
      >
        <div className="touch-none cursor-grab px-4 pt-2.5" onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}>
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/40" />
          <div className="flex items-center justify-between gap-2 py-2">
            <h2 id={titleId} className={hideTitle ? 'sr-only' : 'text-base font-semibold'}>
              {title}
            </h2>
            <button type="button" aria-label="Fechar" onClick={onClose} className="ml-auto flex size-9 items-center justify-center rounded-full hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
        </div>
        {children(titleId)}
      </div>
    </div>,
    document.body,
  );
};

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
