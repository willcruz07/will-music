import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Play, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { type Setlist, type SetlistItem, type Song, db, listSongs } from '../lib/db.ts';
import { deleteSetlist, keyOptions, moveItem, updateSetlist } from '../lib/setlists.ts';
import { ExportButton } from '../components/PackageButtons.tsx';
import { Button, IconButton } from '../ui/Button.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';
import { SheetSelect } from '../ui/SheetSelect.tsx';

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

type Row = { key: string; index: number; item: SetlistItem; song?: Song };

const ItemRow = ({ row, count, onChange, onMove, onRemove }: { row: Row; count: number; onChange: (patch: Partial<SetlistItem>) => void; onMove: (to: number) => void; onRemove: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.key });
  const title = row.song?.title ?? 'Música não encontrada';
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex flex-wrap items-center gap-2 border-b border-border bg-background py-3">
      <button type="button" className="cursor-grab touch-none p-2 text-muted-foreground" aria-label={`Arrastar ${title}`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <span className="w-6 text-right tabular-nums text-muted-foreground">{row.index + 1}</span>
      <span className="min-w-40 flex-1">
        <span className={`block font-semibold ${row.song ? '' : 'text-danger'}`}>{title}</span>
        <span className="block text-sm text-muted-foreground">{row.song?.artist}</span>
      </span>
      {row.song?.key && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Tom</span>
          <SheetSelect
            label={`Tom de ${title}`}
            value={row.item.targetKey ?? ''}
            onChange={(v) => onChange({ targetKey: v || undefined })}
            valueClassName="font-bold text-chord"
            options={[{ value: '', label: `${row.song.key} (original)` }, ...keyOptions(row.song.key).slice(1).map((k) => ({ value: k, label: k }))]}
          />
        </label>
      )}
      <input
        aria-label={`Observação de ${title}`}
        placeholder="Observação"
        value={row.item.note ?? ''}
        onChange={(e) => onChange({ note: e.target.value || undefined })}
        className="h-10 w-40 rounded-lg border border-border bg-surface px-2 text-sm"
      />
      <IconButton label={`Subir ${title}`} disabled={row.index === 0} onClick={() => onMove(row.index - 1)}>
        <ArrowUp className="size-4" />
      </IconButton>
      <IconButton label={`Descer ${title}`} disabled={row.index === count - 1} onClick={() => onMove(row.index + 1)}>
        <ArrowDown className="size-4" />
      </IconButton>
      <IconButton label={`Remover ${title}`} onClick={onRemove}>
        <Trash2 className="size-4" />
      </IconButton>
    </li>
  );
};

export const SetlistEdit = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [query, setQuery] = useState('');
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    void Promise.all([db.setlists.get(id), listSongs()]).then(([s, all]) => {
      setSetlist(s ?? null);
      setSongs(all);
    });
  }, [id]);

  const save = useCallback(
    (patch: Partial<Setlist>) => {
      setSetlist((current) => (current ? { ...current, ...patch } : current));
      void updateSetlist(id, patch);
    },
    [id],
  );

  const rows: Row[] = useMemo(
    () => (setlist?.items ?? []).map((item, index) => ({ key: `${index}-${item.songId}`, index, item, song: songs.find((s) => s.id === item.songId) })),
    [setlist, songs],
  );

  const results = useMemo(() => {
    const q = fold(query.trim());
    return q ? songs.filter((s) => fold(`${s.title} ${s.artist}`).includes(q)).slice(0, 8) : [];
  }, [query, songs]);

  if (!setlist) return null;
  const items = setlist.items;

  const onDragEnd = (e: DragEndEvent) => {
    const from = rows.findIndex((r) => r.key === e.active.id);
    const to = rows.findIndex((r) => r.key === e.over?.id);
    if (from >= 0 && to >= 0 && from !== to) save({ items: moveItem(items, from, to) });
  };

  return (
    <section>
      <Link to="/listas" className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Listas
      </Link>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="sr-only">Nome da lista</span>
          <input aria-label="Nome da lista" value={setlist.name} onChange={(e) => save({ name: e.target.value })} className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none focus:underline" />
        </label>
        <label className="text-sm">
          <span className="block text-muted-foreground">Data</span>
          <input type="date" aria-label="Data" value={setlist.date ?? ''} onChange={(e) => save({ date: e.target.value || undefined })} className="h-10 rounded-lg border border-border bg-surface px-2" />
        </label>
        <ExportButton songIds={items.map((i) => i.songId)} title={setlist.name} setlist={setlist} label="Exportar lista" />
        <Button onClick={() => navigate(`/palco/lista/${id}`)} disabled={items.length === 0}>
          <Play className="size-4" /> Tocar no palco
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          <ol className="mt-6 border-t border-border">
            {rows.map((row) => (
              <ItemRow
                key={row.key}
                row={row}
                count={rows.length}
                onMove={(to) => save({ items: moveItem(items, row.index, to) })}
                onRemove={() => save({ items: items.filter((_, i) => i !== row.index) })}
                onChange={(patch) => save({ items: items.map((it, i) => (i === row.index ? { ...it, ...patch } : it)) })}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="mt-6 max-w-xl">
        <label className="block text-sm font-semibold" htmlFor="add-song">
          Adicionar músicas
        </label>
        <input
          id="add-song"
          aria-label="Buscar música para adicionar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar na biblioteca"
          className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
        />
        <ul className="mt-2">
          {results.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-semibold">{s.title}</span> <span className="text-sm text-muted-foreground">{s.artist}</span>
              </span>
              <IconButton label={`Adicionar ${s.title}`} onClick={() => save({ items: [...items, { songId: s.id }] })}>
                <Plus className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      </div>

      <Button
        variant="ghost"
        className="mt-10 text-danger"
        onClick={() => {
          void confirmDialog({ title: 'Excluir a lista?', message: `A lista “${setlist.name}” será excluída. As músicas continuam na biblioteca.`, confirmLabel: 'Excluir' }).then(
            (ok) => {
              if (ok) void deleteSetlist(id).then(() => navigate('/listas'));
            },
          );
        }}
      >
        <Trash2 className="size-4" /> Excluir lista
      </Button>
    </section>
  );
};
