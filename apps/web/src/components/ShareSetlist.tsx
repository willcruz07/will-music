import { Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Setlist } from '../lib/db.ts';
import type { SetlistInvite } from '../lib/sharingTypes.ts';
import { useOnline } from '../lib/online.ts';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';

export const ShareSetlist = ({ list, disabled }: { list: Setlist; disabled?: boolean }) => {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invites, setInvites] = useState<SetlistInvite[]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open || !online) return;
    let active = true;
    void import('../lib/cloud/sharing.ts').then(async api => {
      try { const items = await api.sentSetlistInvites(list.id); if (active) setInvites(items); }
      catch (error) { if (active) setError(api.sharingError(error)); }
    }).catch(() => { if (active) setError('Não foi possível carregar o compartilhamento.'); });
    return () => { active = false; };
  }, [open, online, list.id, revision]);
  const execute = async (action: 'send' | 'update') => {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const api = await import('../lib/cloud/sharing.ts');
      try {
        if (action === 'send') { await api.sendSetlistInvite(list, email); setEmail(''); setNotice('Convite enviado. A pessoa poderá aceitar nas notificações do Will-Music.'); }
        else { await api.updateSharedSetlist(list); setNotice('Versão publicada. Os convidados poderão aceitar a atualização.'); }
        setRevision(value => value + 1);
      } catch (error) { setError(api.sharingError(error)); }
    } catch { setError('Não foi possível carregar o compartilhamento.'); }
    finally { setBusy(false); }
  };
  return <><Button variant="outline" disabled={disabled || !list.items.length} onClick={() => { setError(null); setNotice(null); setOpen(true); }}><Share2 className="size-4" />Compartilhar</Button>
    {open && <BottomSheet title="Compartilhar setlist" onClose={() => { if (!busy) setOpen(false); }} initialFocus={panel => panel.querySelector('input')}>{() => <div className="overflow-y-auto px-4 pb-5">
      <h3 className="break-words text-lg font-semibold">{list.name}</h3><p className="mt-2 text-sm text-muted-foreground">Envie o repertório com a ordem, os tons e o texto das cifras. Você continua sendo o dono; cada pessoa aceita o convite e mantém uma cópia para leitura offline. Áudios não são enviados.</p>
      <form className="mt-4" onSubmit={event => { event.preventDefault(); void execute('send'); }}><label className="text-sm font-semibold">E-mail da conta Google<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3" placeholder="musico@gmail.com" /></label><Button type="submit" disabled={busy || !online || !email.trim()} className="mt-3 w-full">{busy ? 'Aguarde…' : 'Enviar convite'}</Button></form>
      {!online && <p className="mt-3 text-sm text-muted-foreground">Conecte-se para compartilhar. Sua setlist local continua disponível.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-chord">{notice}</p>}
      <section className="mt-6 border-t border-border pt-4"><h3 className="font-semibold">Pessoas convidadas</h3>{!invites.length && <p className="mt-2 text-sm text-muted-foreground">Nenhum convite enviado para esta setlist.</p>}<ul className="mt-2 divide-y divide-border">{invites.map(invite => <li key={invite.id} className="py-3"><p className="break-all text-sm">{invite.recipientEmail || invite.recipientName || 'Músico convidado'}</p><p className="mt-1 text-xs text-muted-foreground">{invite.status === 'pending' ? 'Aguardando resposta' : invite.status === 'declined' ? 'Recusado' : `Aceito · versão ${invite.acceptedVersion}`}{invite.status === 'accepted' && invite.offeredVersion > invite.acceptedVersion ? ' · atualização disponível' : ''}</p></li>)}</ul></section>
      {invites.length > 0 && <Button className="mt-4 w-full" variant="outline" disabled={busy || !online} onClick={() => void execute('update')}>Publicar atualização do repertório</Button>}
    </div>}</BottomSheet>}
  </>;
};
