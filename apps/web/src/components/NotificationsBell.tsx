import { Bell, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getAccountState, useAccount } from '../lib/account.ts';
import { db } from '../lib/db.ts';
import { invitationNeedsAction, LIBRARY_CHANGED, type SetlistInvite, type SharedSetlist } from '../lib/sharingTypes.ts';
import { useOnline } from '../lib/online.ts';
import { AccountAvatar } from './AccountAvatar.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';

export const OwnerAvatar = ({ uid, name, photo, className = 'size-10' }: { uid: string; name: string; photo: string; className?: string }) => <AccountAvatar className={className} user={{ uid, name, photo, email: '' }} />;

export const NotificationsBell = () => {
  const { user } = useAccount(); const online = useOnline();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SetlistInvite[]>([]);
  const [downloaded, setDownloaded] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<SharedSetlist | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user?.email) return;
    let active = true; let stop = () => {};
    setItems([]); setError(null);
    void import('../lib/cloud/sharing.ts').then(api => {
      if (!active) return;
      stop = api.watchInvites(user.email, value => { if (active) setItems(value); }, error => { if (active) setError(api.sharingError(error)); });
    }).catch(() => { if (active) setError('Não foi possível carregar as notificações.'); });
    return () => { active = false; stop(); };
  }, [user?.uid, user?.email, revision]);
  useEffect(() => {
    let active = true;
    const refresh = () => { void db.sharedSetlists.toArray().then(lists => { if (active) setDownloaded(Object.fromEntries(lists.map(list => [list.id, list.version]))); }).catch(() => {}); };
    refresh(); window.addEventListener(LIBRARY_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(LIBRARY_CHANGED, refresh); };
  }, [user?.uid]);
  const act = async (invite: SetlistInvite, action: 'accept' | 'decline' | 'preview') => {
    if (busy) return;
    const uid = user?.uid;
    setBusy(invite.id); setError(null);
    try {
      const api = await import('../lib/cloud/sharing.ts');
      try {
        if (action === 'accept') {
          if (!invitationNeedsAction(invite) && invite.status === 'accepted') await api.restoreAcceptedSetlist(invite);
          else await api.acceptSetlistInvite(invite);
        }
        else if (action === 'decline') await api.declineSetlistInvite(invite);
        else { const result = await api.downloadSharedVersion(invite); if (uid === getAccountState().user?.uid) setPreview(result); }
      } catch (error) { setError(api.sharingError(error)); }
    } catch { setError('Não foi possível concluir a operação.'); }
    finally { setBusy(null); }
  };
  const count = items.filter(invitationNeedsAction).length;
  return <><button type="button" aria-label={count ? `Notificações: ${count} convites pendentes` : 'Notificações'} title="Notificações" onClick={() => { setPreview(null); setOpen(true); }} className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted"><Bell className="size-5" />{count > 0 && <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{count > 99 ? '99+' : count}</span>}</button>
    {open && <BottomSheet title="Notificações" onClose={() => { if (!busy) setOpen(false); }}>{() => <div className="overflow-y-auto px-4 pb-5">
      {!online && <p className="mb-3 text-sm text-muted-foreground">Conecte-se para responder aos convites. Repertórios já baixados continuam no Palco.</p>}
      {error && <div role="alert" className="mb-4 rounded-xl border border-danger/30 p-3"><p className="text-sm">{error}</p><Button variant="outline" className="mt-2" disabled={!!busy} onClick={() => setRevision(value => value + 1)}>Tentar novamente</Button></div>}
      {!items.length && !error && <p className="py-5 text-sm text-muted-foreground">Os convites de setlists enviados para sua conta aparecerão aqui.</p>}
      <ul className="space-y-3">{items.map(invite => {
        const actionNeeded = invitationNeedsAction(invite);
        const missingDownload = invite.status === 'accepted' && (downloaded[invite.shareId] ?? 0) < invite.acceptedVersion;
        return <li key={invite.id} className="rounded-2xl border border-border bg-surface p-4"><div className="flex gap-3"><OwnerAvatar uid={invite.senderUid} name={invite.senderName} photo={invite.senderPhoto} /><div className="min-w-0"><p className="text-xs text-muted-foreground">{invite.senderName} compartilhou uma setlist</p><h3 className="mt-1 break-words font-semibold">{invite.name}</h3><p className="mt-1 text-xs text-muted-foreground">{invite.itemCount} cifras · versão {invite.offeredVersion}</p></div></div>
          <p className="mt-3 text-xs text-muted-foreground">{actionNeeded ? invite.status === 'accepted' ? 'Nova versão disponível. Sua cópia atual será mantida até você aceitar.' : 'Convite aguardando sua resposta.' : invite.status === 'declined' ? 'Convite recusado.' : 'Repertório aceito.'}</p>
          <div className="mt-3 flex flex-wrap gap-2">{(actionNeeded || missingDownload) && <Button disabled={!online || !!busy} onClick={() => void act(invite, 'accept')}>{busy === invite.id ? 'Aguarde…' : missingDownload && !actionNeeded ? 'Baixar para offline' : invite.status === 'accepted' ? 'Aceitar atualização' : 'Aceitar'}</Button>}{actionNeeded && <Button variant="outline" disabled={!online || !!busy} onClick={() => void act(invite, 'decline')}>{invite.status === 'accepted' ? 'Manter versão atual' : 'Recusar'}</Button>}{invite.status !== 'declined' && <Button variant="ghost" disabled={!online || !!busy} onClick={() => void act(invite, 'preview')}>Ver detalhes</Button>}{downloaded[invite.shareId] && <Link to={`/palco/compartilhada/${encodeURIComponent(invite.shareId)}`} onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center gap-1 px-2 text-sm font-semibold text-chord">Ler no palco<ChevronRight className="size-4" /></Link>}</div>
        </li>;
      })}</ul>
      {preview && <section className="mt-5 border-t border-border pt-4"><h3 className="font-semibold">{preview.name} · versão {preview.version}</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">{preview.items.map(item => <li key={item.order}>{item.song.title}{item.targetKey || item.song.key ? ` · ${item.targetKey || item.song.key}` : ''}</li>)}</ol></section>}
    </div>}</BottomSheet>}
  </>;
};
