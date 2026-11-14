import { ArrowLeft, ExternalLink, MapPin, Music2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { AccountAvatar } from '../components/AccountAvatar.tsx';
import { InviteMusician } from '../components/InviteMusician.tsx';
import { useAccount } from '../lib/account.ts';
import { MUSICAL_LEVELS } from '../lib/musicianProfile.ts';
import type { PublicMusician } from '../lib/musicians.ts';
import { useOnline } from '../lib/online.ts';
import { Button } from '../ui/Button.tsx';

const socialNames = { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook', website: 'Site ou portfólio' };
export const Musician = () => {
  const { id = '' } = useParams(); const location = useLocation(); const { user } = useAccount(); const online = useOnline();
  const [musician, setMusician] = useState<PublicMusician | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0);
  const from = location.state?.from;
  const backTo = typeof from === 'string' && (from === '/musicos' || from.startsWith('/musicos?')) ? from : '/musicos';
  useEffect(() => {
    let active = true; setMusician(null); setError(null);
    if (!online) { setLoading(false); return; }
    setLoading(true);
    void import('../lib/cloud/musicians.ts').then(async api => {
      try { const value = await api.getMusician(id); if (active) setMusician(value); }
      catch (error) { if (active) setError(api.musiciansError(error)); }
    }).catch(() => { if (active) setError('Não foi possível abrir o perfil.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, online, retry]);
  const own = user?.uid === id;
  return <section className="mx-auto max-w-3xl">
    <Link to={backTo} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" />Encontrar músicos</Link>
    {!online ? <p role="status" className="mt-5 rounded-2xl border border-border p-5 text-sm text-muted-foreground">Conecte-se para consultar este perfil e enviar convites.</p> : loading ? <div role="status" aria-label="Carregando perfil do músico" className="mt-5 h-72 animate-pulse rounded-3xl bg-muted" /> : error ? <div role="alert" className="mt-5 rounded-2xl border border-danger/30 p-5"><p>{error}</p><Button variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button></div> : !musician ? <div className="mt-5 rounded-2xl border border-border p-5"><h1 className="text-xl font-semibold">Perfil indisponível</h1><p className="mt-2 text-sm text-muted-foreground">A pessoa pode ter retirado seu perfil da busca ou ainda não ter publicado os dados.</p>{own && <Link to="/conta" className="mt-3 inline-flex min-h-11 items-center font-semibold text-chord">Configurar meu perfil</Link>}</div> : <>
      <header className="mt-4 rounded-3xl border border-border bg-surface p-5 sm:p-7"><div className="flex items-center gap-4"><AccountAvatar user={{ uid: musician.uid, name: musician.name, photo: musician.photo, email: '' }} className="size-20" /><div className="min-w-0"><h1 className="break-words text-2xl font-bold sm:text-3xl">{musician.name}</h1><p className="mt-2 flex items-start gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" />{[musician.location.city, musician.location.region, musician.location.country].filter(Boolean).join(' · ') || 'Localização não informada'}</p>{musician.experience && <p className="mt-2 text-xs text-chord">{MUSICAL_LEVELS[musician.experience]}</p>}</div></div>
        <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{musician.bio || 'Este músico ainda não adicionou uma apresentação.'}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">{own ? <Link to="/conta" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground">Editar meu perfil</Link> : <InviteMusician musician={musician} />}{!musician.acceptsInvites && <p className="text-xs text-muted-foreground">Sem novos convites de setlists no momento.</p>}</div>
      </header>
      <section className="mt-4 rounded-2xl border border-border bg-surface p-5"><h2 className="flex items-center gap-2 font-semibold"><Music2 className="size-4 text-chord" />Instrumentos e voz</h2><div className="mt-3 flex flex-wrap gap-2">{musician.instruments.length ? musician.instruments.map(value => <span key={value} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm text-chord">{value}</span>) : <p className="text-sm text-muted-foreground">Ainda não informado.</p>}</div><h2 className="mt-5 font-semibold">Estilos musicais</h2><div className="mt-3 flex flex-wrap gap-2">{musician.styles.length ? musician.styles.map(value => <span key={value} className="rounded-full border border-border px-3 py-1.5 text-sm">{value}</span>) : <p className="text-sm text-muted-foreground">Ainda não informado.</p>}</div></section>
      {Object.values(musician.socials).some(Boolean) && <section className="mt-4 rounded-2xl border border-border bg-surface p-5"><h2 className="font-semibold">Conheça o trabalho</h2><div className="mt-3 flex flex-wrap gap-2">{(Object.keys(socialNames) as (keyof typeof socialNames)[]).filter(key => musician.socials[key]).map(key => <a key={key} href={musician.socials[key]} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-chord">{socialNames[key]}<ExternalLink className="size-3.5" /></a>)}</div></section>}
    </>}
  </section>;
};
