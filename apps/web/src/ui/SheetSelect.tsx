import { Check, ChevronDown } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet.tsx';

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
  searchable = false,
  disabled = false,
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
  searchable?: boolean;
  disabled?: boolean;
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
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 min-w-0 max-w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-left text-sm hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <span className={`truncate ${valueClassName}`}>{renderValue ? renderValue(current) : (current?.label ?? '—')}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <Sheet
          title={title ?? label}
          options={options}
          value={value}
          searchable={searchable}
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

const Sheet = ({ title, options, value, searchable, onClose, onPick }: { title: string; options: SheetOption[]; value: string; searchable: boolean; onClose: () => void; onPick: (v: string) => void }) => {
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
  const visible = query.trim() ? options.filter(option => fold(`${option.label} ${option.hint ?? ''}`).includes(fold(query.trim()))) : options;

  const onListKey = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
    items[next]?.focus();
  };

  const groups: { name?: string; items: SheetOption[] }[] = [];
  for (const o of visible) {
    const g = groups[groups.length - 1];
    if (g && g.name === o.group) g.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }

  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      initialFocus={(panel) => panel.querySelector<HTMLElement>('[aria-selected="true"]') ?? panel.querySelector<HTMLElement>('[role="option"]')}
    >
      {(titleId) => {
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
        return (
          <>
          {searchable && <div className="shrink-0 px-4 pb-3"><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={`Buscar em ${title}`} placeholder="Buscar pelo nome…" autoComplete="off" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-base" /></div>}
          <div ref={list} role="listbox" aria-labelledby={titleId} onKeyDown={onListKey} className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-4">
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
            {!visible.length && <p role="status" className="px-4 py-5 text-sm text-muted-foreground">Nenhum resultado para essa busca.</p>}
          </div>
          </>
        );
      }}
    </BottomSheet>
  );
};
