import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Loader2, Play, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { type Setlist, type SetlistItem, type Song, db, listSongs } from '../lib/db.ts';
import { moveItem, updateSetlist } from '../lib/setlists.ts';
import { ShareSetlist } from '../components/ShareSetlist.tsx';
import { Button, IconButton } from '../ui/Button.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { LibraryEmptyState } from '../components/LibraryEmptyState.tsx';

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

type Row = { key: string; index: number; item: SetlistItem; song?: Song };

const ItemRow = ({ row, count, onMove, onRemove }: { row: Row; count: number; onMove: (to: number) => void; onRemove: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.key });
  const title = row.song?.title ?? 'Música não encontrada';
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-2xl border bg-surface py-1.5 pl-1 pr-1.5 sm:gap-2 ${isDragging ? 'relative z-10 border-primary shadow-lg' : 'border-border'}`}
    >
      <button type="button" className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label={`Arrastar ${title}`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold tabular-nums text-chord">{row.index + 1}</span>
      <span className="min-w-0 flex-1 px-1">
        <span className={`block truncate font-semibold ${row.song ? '' : 'text-danger'}`}>{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{row.song ? [row.song.artist, row.song.key && `Tom ${row.song.key}`].filter(Boolean).join(' · ') : 'Removida da biblioteca'}</span>
      </span>
      <span className="hidden sm:contents">
        <IconButton label={`Subir ${title}`} disabled={row.index === 0} onClick={() => onMove(row.index - 1)}><ArrowUp className="size-4" /></IconButton>
        <IconButton label={`Descer ${title}`} disabled={row.index === count - 1} onClick={() => onMove(row.index + 1)}><ArrowDown className="size-4" /></IconButton>
      </span>
      <IconButton label={`Tirar ${title} da setlist`} onClick={onRemove}><X className="size-4" /></IconButton>
    </li>
  );
};

export const SetlistEdit = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [eligibleIds, setEligibleIds] = useState(new Set<string>());
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(new Set<string>());
  const [resultLimit, setResultLimit] = useState(30);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currentList = useRef<Setlist | null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const writeRevision = useRef(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    let active = true;
    setLoaded(false); setError(null);
    void Promise.all([db.setlists.get(id), listSongs(), db.charts.toArray(), db.audio.toCollection().primaryKeys()]).then(([s, all, charts, audioIds]) => {
      if (!active) return;
      const used = new Set<string>();
      const list = s ? { ...s, items: s.items.map(item => {
        const itemId = item.id && !used.has(item.id) ? item.id : crypto.randomUUID(); used.add(itemId);
        return { ...item, id: itemId };
      }) } : null;
      currentList.current = list; setSetlist(list);
      const chartIds = new Set(charts.filter(chart => chart.chordPro.trim()).map(chart => chart.songId));
      const audio = new Set(audioIds);
      // Keep old repertoire references visible; selection below contains independent saved charts only.
      setSongs(all);
      setEligibleIds(new Set(all.filter(song => chartIds.has(song.id) && !audio.has(song.id)).map(song => song.id)));
      setLoaded(true);
    }).catch(() => { if (active) { setError('Não foi possível carregar este repertório. Volte ao Palco e tente novamente.'); setLoaded(true); } });
    return () => { active = false; currentList.current = null; };
  }, [id]);

  const save = useCallback(
    (patch: Partial<Setlist>) => {
      const current = currentList.current;
      if (!current || current.id !== id) return;
      const next = { ...current, ...patch };
      currentList.current = next; setSetlist(next); setSaving(true);
      const ticket = ++writeRevision.current;
      // Full snapshots make the last successful write include earlier edits and preserve action order.
      writes.current = writes.current.catch(() => {}).then(() => updateSetlist(id, { name: next.name, items: next.items }))
        .then(() => { if (currentList.current?.id === id && ticket === writeRevision.current) setError(null); })
        .catch(() => { if (currentList.current?.id === id && ticket === writeRevision.current) setError('Não foi possível salvar. Suas alterações continuam nesta tela; tente salvar novamente.'); })
        .finally(() => { if (currentList.current?.id === id && ticket === writeRevision.current) setSaving(false); });
    },
    [id],
  );

  const rows: Row[] = useMemo(
    () => (setlist?.items ?? []).map((item, index) => ({ key: item.id!, index, item, song: songs.find((s) => s.id === item.songId) })),
    [setlist, songs],
  );

  const results = useMemo(() => {
    const q = fold(query.trim());
    return songs.filter(s => eligibleIds.has(s.id) && !setlist?.items.some(item => item.songId === s.id) && (!q || fold(`${s.title} ${s.artist}`).includes(q)));
  }, [query, songs, setlist, eligibleIds]);

  if (!setlist) return <section><Link to="/palco" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" />Palco</Link><p className="mt-4 text-muted-foreground" role={error ? 'alert' : 'status'}>{error ?? (loaded ? 'Este repertório não foi encontrado.' : 'Carregando repertório…')}</p></section>;
  const items = setlist.items;

  const onDragEnd = (e: DragEndEvent) => {
    const from = rows.findIndex((r) => r.key === e.active.id);
    const to = rows.findIndex((r) => r.key === e.over?.id);
    if (from >= 0 && to >= 0 && from !== to) save({ items: moveItem(items, from, to) });
  };

  return (
    <section className="pb-28 sm:pb-6">
      <Link to="/palco" className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-chord hover:text-primary">
        <ArrowLeft className="size-4" /> Palco
      </Link>
      <label className="mt-2 block">
        <span className="sr-only">Nome da setlist</span>
        <input aria-label="Nome da setlist" value={setlist.name} onChange={(e) => save({ name: e.target.value })} className="w-full rounded-lg bg-transparent text-2xl font-bold tracking-tight outline-none focus:bg-surface sm:text-3xl" />
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-muted-foreground">{items.length} {items.length === 1 ? 'cifra' : 'cifras'}</span>
        {saving && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status"><Loader2 className="size-3 animate-spin" aria-hidden /> Salvando</span>}
        <span className="flex-1" />
        <ShareSetlist list={{ ...setlist, items }} disabled={saving || !!error} />
        <Button className="hidden sm:inline-flex" onClick={() => navigate(`/palco/lista/${id}`)} disabled={items.length === 0 || saving || !!error}><Play className="size-4" /> Ler no palco</Button>
      </div>
      {error && <div role="alert" className="mt-3 rounded-xl border border-danger/30 p-3"><p className="text-sm">{error}</p><Button className="mt-2" variant="outline" disabled={saving} onClick={() => save({})}>Salvar novamente</Button></div>}
      {!items.length && <LibraryEmptyState section="Repertório" title="Escolha as cifras desta apresentação" description="Adicione cifras da sua biblioteca. A ordem que você montar aqui será a sequência da leitura no palco." />}
      {items.length > 1 && <p className="mt-4 text-xs text-muted-foreground">Segure a alça <GripVertical className="inline size-3.5 align-[-2px]" aria-hidden /> e arraste para mudar a ordem.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          <ol className="mt-2 space-y-2">
            {rows.map((row) => (
              <ItemRow
                key={row.key}
                row={row}
                count={rows.length}
                onMove={(to) => save({ items: moveItem(items, row.index, to) })}
                onRemove={() => save({ items: items.filter((_, i) => i !== row.index) })}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button type="button" onClick={() => { setQuery(''); setSelected(new Set()); setResultLimit(30); setAdding(true); }} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-semibold text-chord transition-colors hover:border-primary hover:bg-primary/5">
        <Plus className="size-4" /> Adicionar cifras
      </button>

      {items.length > 0 && <div className="fixed inset-x-0 bottom-[calc(var(--nav-height,0px)+env(safe-area-inset-bottom)+0.75rem)] z-20 px-4 sm:hidden">
        <Button className="w-full shadow-lg" onClick={() => navigate(`/palco/lista/${id}`)} disabled={saving || !!error}><Play className="size-4" /> Ler no palco</Button>
      </div>}

      {adding && <BottomSheet title="Adicionar cifras à setlist" onClose={() => setAdding(false)} initialFocus={panel => panel.querySelector('input')}>{() => <div className="overflow-y-auto overscroll-contain px-4 pb-5">
        <label className="block text-sm font-semibold" htmlFor="add-song">
          Cifras salvas na biblioteca
        </label>
        <input
          id="add-song"
          aria-label="Buscar música para adicionar"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setResultLimit(30); }}
          placeholder="Buscar na biblioteca"
          className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
        />
        <ul className="mt-2">
          {results.slice(0, resultLimit).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-semibold">{s.title}</span> <span className="text-sm text-muted-foreground">{s.artist}</span>
              </span>
              <input type="checkbox" aria-label={`Selecionar ${s.title}`} checked={selected.has(s.id)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(s.id); else next.delete(s.id); return next; })} className="size-5 shrink-0 accent-primary" />
            </li>
          ))}
        </ul>
        {!results.length && <p className="mt-4 text-sm text-muted-foreground">{query.trim() ? 'Nenhuma cifra encontrada nesta busca.' : 'Não há outras cifras salvas disponíveis. Salve uma cifra na biblioteca para adicioná-la aqui.'}</p>}
        {results.length > resultLimit && <Button variant="outline" className="mt-3 w-full" onClick={() => setResultLimit(value => value + 30)}>Mostrar mais cifras</Button>}
        <div className="sticky bottom-0 mt-4 border-t border-border bg-surface pt-3"><Button className="w-full" disabled={!selected.size} onClick={() => { save({ items: [...items, ...[...selected].filter(songId => eligibleIds.has(songId) && !items.some(item => item.songId === songId)).map(songId => ({ id: crypto.randomUUID(), songId }))] }); setAdding(false); }}>Adicionar {selected.size ? `(${selected.size})` : 'cifras'}</Button></div>
      </div>}</BottomSheet>}

    </section>
  );
};
