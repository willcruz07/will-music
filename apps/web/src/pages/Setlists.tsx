import { BookOpen, ListMusic, Plus, SlidersHorizontal, Trash2, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LIBRARY_CHANGED, type SharedSetlist } from '../lib/sharingTypes.ts';
import { OwnerAvatar } from '../components/NotificationsBell.tsx';
import { db, type Setlist } from '../lib/db.ts';
import { createSetlist, deleteSetlist, listSetlists } from '../lib/setlists.ts';
import { confirmDialog } from '../ui/Dialog.tsx';
import { Button } from '../ui/Button.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { LibraryEmptyState } from '../components/LibraryEmptyState.tsx';

const count = (n: number) => `${n} ${n === 1 ? 'cifra' : 'cifras'}`;

export const Setlists = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<Setlist[] | null>(null);
  const [shared, setShared] = useState<SharedSetlist[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => { const changed = () => setRevision(v => v + 1); window.addEventListener(LIBRARY_CHANGED, changed); return () => window.removeEventListener(LIBRARY_CHANGED, changed); }, []);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void Promise.all([listSetlists(), db.sharedSetlists.toArray()]).then(async ([value, received]) => {
      // The first songs of each list, shown on its card.
      const ids = [...new Set(value.flatMap((list) => list.items.slice(0, 3).map((item) => item.songId)))];
      const songs = await db.songs.bulkGet(ids);
      if (!active) return;
      setTitles(new Map(songs.flatMap((song) => (song ? [[song.id, song.title] as [string, string]] : []))));
      setLists(value); setShared(received);
    }).catch(() => { if (active) setError('Não foi possível carregar seus repertórios.'); });
    return () => { active = false; };
  }, [revision]);
  const create = async () => {
    if (lock.current || !name.trim()) return;
    lock.current = true; setBusy(true); setError(null);
    try { const list = await createSetlist(name.trim()); navigate(`/palco/repertorio/${list.id}`); }
    catch { setError('Não foi possível criar a setlist. Tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const remove = (list: Setlist) => void confirmDialog({ title: 'Excluir a setlist?', message: `A setlist “${list.name}” será excluída. As cifras continuam na biblioteca.`, confirmLabel: 'Excluir' }).then(async (ok) => {
    if (!ok) return;
    setDeleting(list.id);
    try { await deleteSetlist(list.id); setLists((current) => current?.filter((l) => l.id !== list.id) ?? null); }
    catch { setError('Não foi possível excluir a setlist. Tente novamente.'); }
    finally { setDeleting(null); }
  });
  return <section>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><h1 className="text-3xl font-bold tracking-tight">Palco</h1><p className="mt-1 text-sm text-muted-foreground">Monte a ordem das cifras e leia em sequência.</p></div>
      <Button className="shrink-0" onClick={() => { setName(''); setCreating(true); }}><Plus className="size-4" /> <span className="hidden sm:inline">Nova setlist</span><span className="sm:hidden">Nova</span></Button>
    </div>
    {error && !creating && <div role="alert" className="mt-4 rounded-xl border border-danger/30 p-3"><p className="text-sm">{error}</p><Button variant="outline" className="mt-2" onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button></div>}
    {!lists && !error && <p role="status" className="mt-6 text-sm text-muted-foreground">Carregando repertórios…</p>}
    {lists?.length === 0 && !shared.length && !error && <LibraryEmptyState section="Palco" title="Prepare seu próximo repertório" description="Crie uma setlist e reúna as cifras salvas que você quer tocar. Depois, ajuste a sequência e leia com foco na música."><Button onClick={() => { setName(''); setCreating(true); }}>Criar primeira setlist</Button><Link to="/?aba=cifras" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-chord">Ver minhas cifras</Link></LibraryEmptyState>}
    {!!lists?.length && <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{lists.map(list => {
      const preview = list.items.slice(0, 3).map((item) => titles.get(item.songId)).filter(Boolean) as string[];
      return <li key={list.id} className="library-card">
        <div className="flex items-center justify-between gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><span className="library-card-icon"><ListMusic className="size-5" aria-hidden /></span>{count(list.items.length)}</span>
          <button type="button" aria-label={`Excluir “${list.name}”`} disabled={deleting === list.id} onClick={() => remove(list)} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"><Trash2 className="size-4" /></button>
        </div>
        <Link to={`/palco/repertorio/${list.id}`} aria-label={`Organizar “${list.name}”`} className="block min-w-0 px-3 pt-1 focus-visible:outline-primary sm:px-4">
          <h2 className="line-clamp-2 break-words text-lg font-semibold leading-6">{list.name}</h2>
          {preview.length ? <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground">{preview.map((title, i) => <li key={i} className="flex gap-2 truncate"><span className="w-3 shrink-0 text-right tabular-nums">{i + 1}</span><span className="truncate">{title}</span></li>)}{list.items.length > 3 && <li className="pl-5">+ {list.items.length - 3}</li>}</ol>
            : <p className="mt-2 text-xs text-muted-foreground">Nenhuma cifra ainda. Toque para adicionar.</p>}
        </Link>
        <div className="mt-auto flex gap-2 px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
          {list.items.length > 0 && <Link to={`/palco/lista/${list.id}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"><BookOpen className="size-4" /> Ler no palco</Link>}
          <Link to={`/palco/repertorio/${list.id}`} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-chord ${list.items.length ? '' : 'flex-1'}`}><SlidersHorizontal className="size-4" /> Organizar</Link>
        </div>
      </li>;
    })}</ul>}
    {shared.length > 0 && <section className="mt-8"><h2 className="text-lg font-semibold">Compartilhadas comigo</h2><ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shared.map(list => <li key={list.id} className="library-card p-3 sm:p-4">
      <div className="flex items-center gap-3"><OwnerAvatar uid={list.ownerUid} name={list.ownerName} photo={list.ownerPhoto} /><div className="min-w-0"><h3 className="truncate font-semibold">{list.name}</h3><p className="truncate text-xs text-muted-foreground">{list.ownerName} · {count(list.items.length)}</p></div></div>
      <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" to={`/palco/compartilhada/${encodeURIComponent(list.id)}`}><BookOpen className="size-4" /> Ler no palco</Link>
    </li>)}</ul></section>}
    <Link to="/musicos" className="mt-8 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-chord"><Users className="size-4" /> Encontrar músicos para tocar junto</Link>
    {creating && <BottomSheet title="Nova setlist" onClose={() => { if (!lock.current) { setCreating(false); setError(null); } }} initialFocus={panel => panel.querySelector('input')}>{() => <form className="overflow-y-auto px-4 pb-5" onSubmit={event => { event.preventDefault(); void create(); }}>
      <label className="block text-sm font-semibold">Nome do repertório<input autoComplete="off" maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ensaio de domingo" className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3" /></label>
      <p className="mt-2 text-sm text-muted-foreground">Na próxima tela você escolhe as cifras e a ordem de leitura.</p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <Button type="submit" className="mt-4 w-full" disabled={busy || !name.trim()}>{busy ? 'Criando…' : 'Criar setlist'}</Button>
    </form>}</BottomSheet>}
  </section>;
};
