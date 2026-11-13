import { ArrowRight, BookOpen, ListMusic, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { LIBRARY_CHANGED, type SharedSetlist } from '../lib/sharingTypes.ts';
import { OwnerAvatar } from '../components/NotificationsBell.tsx';
import { db, type Setlist } from '../lib/db.ts';
import { createSetlist, listSetlists } from '../lib/setlists.ts';
import { Button } from '../ui/Button.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { LibraryEmptyState } from '../components/LibraryEmptyState.tsx';

const dateLabel = (iso?: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '';

export const Setlists = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<Setlist[] | null>(null);
  const [shared, setShared] = useState<SharedSetlist[]>([]);
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
    void Promise.all([listSetlists(), db.sharedSetlists.toArray()]).then(([value, received]) => { if (active) { setLists(value); setShared(received); } }).catch(() => { if (active) setError('Não foi possível carregar seus repertórios.'); });
    return () => { active = false; };
  }, [revision]);
  const create = async () => {
    if (lock.current || !name.trim()) return;
    lock.current = true; setBusy(true); setError(null);
    try { const list = await createSetlist(name.trim()); navigate(`/palco/repertorio/${list.id}`); }
    catch { setError('Não foi possível criar a setlist. Tente novamente.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold tracking-tight">Palco</h1><Button onClick={() => { setName(''); setCreating(true); }}><Plus className="size-4" /> Nova setlist</Button></div>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Organize suas cifras para o ensaio ou apresentação. Escolha a ordem e leia todo o repertório em sequência, sem sair da tela.</p>
    {error && !creating && <div role="alert" className="mt-4 rounded-xl border border-danger/30 p-3"><p className="text-sm">{error}</p><Button variant="outline" className="mt-2" onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button></div>}
    {!lists && !error && <p role="status" className="mt-6 text-sm text-muted-foreground">Carregando repertórios…</p>}
    {lists?.length === 0 && !shared.length && !error && <LibraryEmptyState section="Palco" title="Prepare seu próximo repertório" description="Crie uma setlist e reúna as cifras salvas que você quer tocar. Depois, ajuste a sequência e abra a leitura com foco na música."><Button onClick={() => { setName(''); setCreating(true); }}>Criar primeira setlist</Button><Link to="/?aba=cifras" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-chord">Ver minhas cifras</Link></LibraryEmptyState>}
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">{lists?.map(list => <li key={list.id} className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><ListMusic className="size-4 text-chord" /><span>{list.items.length} {list.items.length === 1 ? 'cifra' : 'cifras'}</span>{list.date && <span>· {dateLabel(list.date)}</span>}</div>
      <h2 className="mt-3 break-words text-lg font-semibold">{list.name}</h2>
      <div className="mt-4 flex flex-wrap gap-2"><Link to={`/palco/repertorio/${list.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-chord">Organizar <ArrowRight className="size-4" /></Link>{list.items.length > 0 && <Link to={`/palco/lista/${list.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground"><BookOpen className="size-4" /> Ler cifras</Link>}</div>
    </li>)}</ul>
    {shared.length > 0 && <section className="mt-8"><h2 className="text-xl font-bold">Compartilhadas comigo</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{shared.map(list => <li key={list.id} className="rounded-2xl border border-border bg-surface p-4"><div className="flex items-center gap-3"><OwnerAvatar uid={list.ownerUid} name={list.ownerName} photo={list.ownerPhoto} /><div className="min-w-0"><h3 className="truncate font-semibold">{list.name}</h3><p className="text-xs text-muted-foreground">{list.ownerName} · versão {list.version} · {list.items.length} cifras</p></div></div><Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground" to={`/palco/compartilhada/${encodeURIComponent(list.id)}`}>Ler cifras</Link></li>)}</ul></section>}
    {creating && <BottomSheet title="Nova setlist" onClose={() => { if (!lock.current) { setCreating(false); setError(null); } }} initialFocus={panel => panel.querySelector('input')}>{() => <form className="overflow-y-auto px-4 pb-5" onSubmit={event => { event.preventDefault(); void create(); }}>
      <label className="block text-sm font-semibold">Nome do repertório<input autoComplete="off" maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Ensaio de domingo" className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3" /></label>
      <p className="mt-2 text-sm text-muted-foreground">Na próxima tela você escolhe as cifras e a ordem de leitura.</p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <Button type="submit" className="mt-4 w-full" disabled={busy || !name.trim()}>{busy ? 'Criando…' : 'Criar setlist'}</Button>
    </form>}</BottomSheet>}
  </section>;
};
