import { ListPlus } from 'lucide-react';
import { useState } from 'react';
import type { Setlist } from '../lib/db.ts';
import { addToSetlist, createSetlist, listSetlists } from '../lib/setlists.ts';
import { Button } from '../ui/Button.tsx';

export const AddToSetlist = ({ songId }: { songId: string }) => {
  const [lists, setLists] = useState<Setlist[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const add = async (list: Setlist) => {
    await addToSetlist(list.id, songId);
    setDone(list.name);
    setLists(null);
  };
  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => void listSetlists().then(setLists)} aria-expanded={!!lists}>
        <ListPlus className="size-4" /> Adicionar a uma lista
      </Button>
      {done && <span className="ml-2 text-sm text-chord" role="status">Adicionada a “{done}”.</span>}
      {lists && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-surface p-2 shadow-sm">
          {lists.map((l) => (
            <button key={l.id} type="button" onClick={() => void add(l)} className="block w-full rounded-md px-3 py-2 text-left hover:bg-muted">
              {l.name}
            </button>
          ))}
          <button type="button" onClick={() => void createSetlist('Nova lista').then(add)} className="block w-full rounded-md px-3 py-2 text-left font-semibold text-chord hover:bg-muted">
            Nova lista com esta música
          </button>
        </div>
      )}
    </div>
  );
};
