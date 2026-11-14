import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { db, type Setlist } from '../lib/db.ts';
import type { PublicMusician } from '../lib/musicians.ts';
import { useOnline } from '../lib/online.ts';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';

export const InviteMusician = ({ musician }: { musician: PublicMusician }) => {
  const online = useOnline();
  const [open, setOpen] = useState(false); const [lists, setLists] = useState<Setlist[]>([]);
  const [selected, setSelected] = useState(''); const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true; setLoading(true); setError(null);
    void db.setlists.orderBy('updatedAt').reverse().toArray().then(value => { if (active) setLists(value.filter(list => list.items.length > 0)); }).catch(() => { if (active) setError('Não foi possível carregar suas setlists.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, retry]);
  const send = async () => {
    if (lock.current || !selected) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const list = await db.setlists.get(selected);
      if (!list) throw new Error('Esta setlist foi removida. Escolha outra.');
      const api = await import('../lib/cloud/sharing.ts');
      try { await api.sendMusicianSetlistInvite(list, musician.uid); setNotice(`Convite enviado para ${musician.name}. A pessoa poderá responder nas notificações.`); }
      catch (error) { setError(api.sharingError(error)); }
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível enviar o convite.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <><Button disabled={!online || !musician.acceptsInvites} onClick={() => { setSelected(''); setNotice(null); setOpen(true); }} className="min-h-11"><Send className="size-4" />Convidar para uma setlist</Button>
    {open && <BottomSheet title={`Convidar ${musician.name}`} onClose={() => { if (!lock.current) setOpen(false); }}>{() => <div className="min-h-0 overflow-y-auto px-4 pb-5">
      <p className="text-sm text-muted-foreground">Escolha um repertório seu. O convite inclui as cifras, a ordem e os tons, sem enviar áudio ou revelar seu e-mail.</p>
      {loading && <p role="status" className="mt-4 text-sm">Carregando suas setlists…</p>}
      {!loading && !lists.length && !error && <div className="mt-4 rounded-xl border border-border p-4"><p className="text-sm">Você precisa de uma setlist com cifras salvas para convidar.</p><Link to="/palco" className="mt-3 inline-flex min-h-11 items-center font-semibold text-chord">Organizar uma setlist no Palco</Link></div>}
      {!notice && <div className="mt-4 space-y-2" role="radiogroup" aria-label="Setlist para compartilhar">{lists.map(list => <button type="button" role="radio" aria-checked={selected === list.id} disabled={busy} key={list.id} onClick={() => setSelected(list.id)} className={`min-h-14 w-full rounded-xl border p-3 text-left ${selected === list.id ? 'border-primary bg-primary/10' : 'border-border'}`}><span className="block break-words font-semibold">{list.name}</span><span className="mt-1 block text-xs text-muted-foreground">{list.items.length} cifras</span></button>)}</div>}
      {error && <div role="alert" className="mt-4 text-sm text-danger"><p>{error}</p>{!lists.length && <Button variant="outline" className="mt-2" disabled={busy} onClick={() => setRetry(value => value + 1)}>Tentar carregar setlists</Button>}</div>}
      {notice ? <p role="status" className="mt-4 text-sm text-chord">{notice}</p> : lists.length > 0 && <Button disabled={!online || busy || !selected || loading} className="mt-5 min-h-12 w-full" onClick={() => void send()}>{busy ? 'Enviando…' : 'Enviar convite'}</Button>}
    </div>}</BottomSheet>}
  </>;
};
