import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button.tsx';

/**
 * The app's own dialogs, in place of the browser's confirm() and alert(): a dimmed, blurred backdrop and a
 * card in the app's style. `confirmDialog` has a primary action and an outlined Cancelar; `alertDialog`
 * a single OK. Both return promises, and requests queue up so they show one at a time.
 */

type Request = {
  kind: 'confirm' | 'alert';
  title?: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (ok: boolean) => void;
};

let queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};
const push = (r: Request) => {
  queue = [...queue, r];
  emit();
};
const settle = (ok: boolean) => {
  const [head, ...rest] = queue;
  if (!head) return;
  queue = rest;
  emit();
  head.resolve(ok);
};

export const confirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
}: {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<boolean> => new Promise((resolve) => push({ kind: 'confirm', title, message, confirmLabel, cancelLabel, resolve }));

export const alertDialog = (message: string, { title }: { title?: string } = {}): Promise<void> =>
  new Promise((resolve) => push({ kind: 'alert', title, message, confirmLabel: 'OK', cancelLabel: '', resolve: () => resolve() }));

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Mounted once at the root of the app: renders the dialog at the head of the queue. */
export const DialogHost = () => {
  const current = useSyncExternalStore(subscribe, () => queue[0]);
  return current ? <DialogCard key={queue.length + current.message} request={current} /> : null;
};

const DialogCard = ({ request }: { request: Request }) => {
  const titleId = useId();
  const textId = useId();
  const primary = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(request.kind === 'alert');
      } else if (e.key === 'Tab' && card.current) {
        // Keep Tab inside the dialog.
        const items = [...card.current.querySelectorAll<HTMLElement>('button')];
        const i = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [request]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <div aria-hidden className="sheet-backdrop absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => settle(request.kind === 'alert')} />
      <div
        ref={card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={request.title ? titleId : textId}
        aria-describedby={request.title ? textId : undefined}
        className="sheet-panel relative w-full max-w-sm rounded-2xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_16px_48px_-12px_rgb(0_0_0/0.5)] sm:pb-5"
      >
        {request.title && (
          <h2 id={titleId} className="text-lg font-semibold">
            {request.title}
          </h2>
        )}
        <p id={textId} className={`${request.title ? 'mt-2 text-muted-foreground' : ''} text-[15px] leading-relaxed`}>
          {request.message}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {request.kind === 'confirm' && (
            <Button variant="outline" className="min-h-11" onClick={() => settle(false)}>
              {request.cancelLabel}
            </Button>
          )}
          <Button ref={primary} className="min-h-11" onClick={() => settle(true)}>
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
