import { ListPlus } from 'lucide-react';
import { useState } from 'react';
import type { Setlist } from '../lib/db.ts';
import { addToSetlist, createSetlistWithSong, listSetlists } from '../lib/setlists.ts';
import { Button } from '../ui/Button.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';

export const AddToSetlist = ({ songId, disabled = false }: { songId: string; disabled?: boolean }) => {
  const [lists, setLists] = useState<Setlist[] | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async (list: Setlist) => {
    setBusy(true); setError(null);
    try { await addToSetlist(list.id, songId); setDone(list.name); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível adicionar à lista.'); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <Button variant="outline" disabled={disabled} onClick={() => { setOpen(true); setLists(null); setError(null); setName(''); void listSetlists().then(setLists).catch(e => setError(String(e))); }} aria-expanded={open}>
        <ListPlus className="size-4" /> Adicionar a uma lista
      </Button>
      {done && <span className="ml-2 text-sm text-chord" role="status">Adicionada a “{done}”.</span>}
      {open && <BottomSheet title="Adicionar cifra a uma lista" onClose={() => { if (!busy) setOpen(false); }}>{() =>
        <div className="space-y-4 overflow-auto px-4 pb-5">
          {!lists && !error && <p role="status" className="text-sm text-muted-foreground">Carregando listas…</p>}
          {lists?.length === 0 && <p className="text-sm text-muted-foreground">Você ainda não tem listas. Crie a primeira abaixo e esta cifra será vinculada.</p>}
          {lists?.map((l) => (
            <button key={l.id} type="button" disabled={busy} onClick={() => void add(l)} className="block min-h-11 w-full rounded-lg border border-border px-3 py-2 text-left hover:bg-muted disabled:opacity-50">
              {l.name}
            </button>
          ))}
          <form className="space-y-3 border-t border-border pt-4" onSubmit={e => { e.preventDefault(); if (busy || !name.trim()) return; setBusy(true); setError(null); void createSetlistWithSong(name, songId).then(list => { setDone(list.name); setOpen(false); }).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível criar a lista.')).finally(() => setBusy(false)); }}>
            <label className="block text-sm font-semibold">Nova lista<input aria-label="Nome da nova lista" value={name} onChange={e => setName(e.target.value)} disabled={busy} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base" placeholder="Nome da lista" /></label>
            <Button type="submit" disabled={busy || !name.trim()}>{busy ? 'Adicionando…' : 'Criar lista e adicionar cifra'}</Button>
          </form>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      }</BottomSheet>}
    </div>
  );
};
