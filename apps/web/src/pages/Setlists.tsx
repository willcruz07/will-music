import { ListMusic, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Setlist } from '../lib/db.ts';
import { createSetlist, listSetlists } from '../lib/setlists.ts';
import { Button } from '../ui/Button.tsx';

const dateLabel = (iso?: string) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }) : '');

export const Setlists = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<Setlist[] | null>(null);
  useEffect(() => {
    void listSetlists().then(setLists);
  }, []);
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Listas</h1>
        <Button onClick={() => void createSetlist('Nova lista').then((s) => navigate(`/listas/${s.id}`))}>
          <Plus className="size-4" /> Nova lista
        </Button>
      </div>
      {lists && lists.length === 0 && (
        <div className="mt-16 max-w-md">
          <ListMusic className="size-10 text-primary" />
          <p className="mt-4 text-xl font-semibold">Nenhuma lista ainda.</p>
          <p className="mt-2 text-muted-foreground">Monte o repertório do culto, do ensaio ou do show e toque as músicas em sequência no modo palco.</p>
        </div>
      )}
      <ul className="mt-4 divide-y divide-border">
        {(lists ?? []).map((l) => (
          <li key={l.id}>
            <Link to={`/listas/${l.id}`} className="-mx-3 flex items-center justify-between gap-4 rounded-lg px-3 py-4 hover:bg-muted">
              <span className="min-w-0">
                <span className="block truncate text-lg font-semibold">{l.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {l.items.length} {l.items.length === 1 ? 'música' : 'músicas'}
                  {l.date ? ` · ${dateLabel(l.date)}` : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
