import { ArrowLeft, ArrowRight, MapPin, Search, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AccountAvatar } from '../components/AccountAvatar.tsx';
import { BRAZIL_STATES, findBrazilState } from '../lib/brazilLocations.ts';
import { MUSICAL_INSTRUMENTS, MUSICAL_STYLES } from '../lib/musicianProfile.ts';
import type { MusicianPage } from '../lib/cloud/musicians.ts';
import type { PublicMusician } from '../lib/musicians.ts';
import { useOnline } from '../lib/online.ts';
import { SheetSelect } from '../ui/SheetSelect.tsx';
import { Button } from '../ui/Button.tsx';

export const Musicians = () => {
  const online = useOnline(); const [params, setParams] = useSearchParams(); const key = params.toString();
  const region = params.get('estado') || ''; const city = params.get('cidade') || '';
  const instrument = params.get('instrumento') || ''; const style = params.get('estilo') || ''; const name = params.get('q') || '';
  const state = findBrazilState(region);
  const [text, setText] = useState(name); const [items, setItems] = useState<PublicMusician[]>([]);
  const [page, setPage] = useState<MusicianPage | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0);
  const [request, setRequest] = useState<{ key: string; cursor: MusicianPage['cursor'] }>({ key: '', cursor: null });
  const [loadedKey, setLoadedKey] = useState('');
  const previousKey = useRef<string | null>(null);
  useEffect(() => setText(name), [name]);
  useEffect(() => {
    let active = true;
    if (!online) { previousKey.current = null; setItems([]); setPage(null); setLoading(false); setError(null); return; }
    const cursor = previousKey.current === key && request.key === key ? request.cursor : null;
    previousKey.current = key;
    if (!cursor) { setItems([]); setPage(null); }
    setLoading(true); setError(null);
    void import('../lib/cloud/musicians.ts').then(async api => {
      try {
        const result = await api.listMusicians({ region, city, instrument, style, name }, cursor);
        if (active) { setItems(previous => cursor ? [...new Map([...previous, ...result.items].map(item => [item.uid, item])).values()] : result.items); setPage(result); setLoadedKey(key); }
      } catch (error) { if (active) setError(api.musiciansError(error)); }
    }).catch(() => { if (active) setError('Não foi possível abrir o diretório de músicos.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [key, request, online, retry]);
  const filter = (field: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(field, value); else next.delete(field); if (field === 'estado') next.delete('cidade'); setParams(next, { replace: true }); };
  const visible = loadedKey === key && online ? items : [];
  const summary = [state?.code, city, instrument, style].filter(Boolean).join(' · ');
  return <section>
    <Link to="/" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" />Biblioteca</Link>
    <div className="mt-3 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold tracking-tight">Encontrar músicos</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Encontre pessoas com quem compartilhar repertórios, estudar e tocar. Aqui aparecem apenas os perfis que escolheram participar.</p></div><Link to="/conta" className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-sm font-semibold text-chord">Gerenciar meu perfil</Link></div>
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 mt-5 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
      <form className="flex gap-2" onSubmit={event => { event.preventDefault(); filter('q', text.trim().slice(0, 90)); }}><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input aria-label="Buscar músico pelo início do nome" value={text} onChange={event => setText(event.target.value)} maxLength={90} className="h-11 w-full min-w-0 bg-transparent text-base outline-none" placeholder="Início do nome ou nome artístico" /></label><Button type="submit" disabled={!online}>Buscar</Button></form>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SheetSelect label="Filtrar por estado" title="Estado do músico" searchable value={state?.code || ''} onChange={value => filter('estado', value)} options={[{ value: '', label: 'Todos os estados' }, ...BRAZIL_STATES.map(item => ({ value: item.code, label: `${item.name} (${item.code})` }))]} className="min-h-11 w-full" />
        <SheetSelect label="Filtrar por cidade" title="Cidade do músico" searchable disabled={!state} value={city} onChange={value => filter('cidade', value)} options={[{ value: '', label: state ? 'Todas as cidades' : 'Escolha o estado' }, ...(state?.cities || []).map(value => ({ value, label: value }))]} className="min-h-11 w-full" />
        <SheetSelect label="Filtrar por instrumento" title="Instrumento ou voz" value={instrument} onChange={value => filter('instrumento', value)} options={[{ value: '', label: 'Instrumentos e voz' }, ...MUSICAL_INSTRUMENTS.map(value => ({ value, label: value }))]} className="min-h-11 w-full" />
        <SheetSelect label="Filtrar por estilo" title="Estilo musical" value={style} onChange={value => filter('estilo', value)} options={[{ value: '', label: 'Todos os estilos' }, ...MUSICAL_STYLES.map(value => ({ value, label: value }))]} className="min-h-11 w-full" />
      </div>
      {(summary || name) && <div className="mt-2 flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs text-muted-foreground">{[name, summary].filter(Boolean).join(' · ')}</p><button className="min-h-9 shrink-0 px-2 text-xs font-semibold text-chord" onClick={() => { setText(''); setParams({}, { replace: true }); }}>Limpar filtros</button></div>}
    </div>
    {!online && <p role="status" className="mt-6 rounded-2xl border border-border p-5 text-sm text-muted-foreground">Conecte-se para consultar os perfis publicados. Suas cifras e setlists baixadas continuam disponíveis offline.</p>}
    {error && <div role="alert" className="mt-5 rounded-xl border border-danger/30 p-4"><p className="text-sm">{error}</p><Button variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button></div>}
    {online && !loading && !error && !visible.length && <div className="mt-6 rounded-2xl border border-border bg-surface p-6"><Users className="size-7 text-chord" /><h2 className="mt-3 text-lg font-semibold">{key ? 'Nenhum músico com esses filtros' : 'Os próximos encontros começam aqui'}</h2><p className="mt-2 text-sm text-muted-foreground">{key ? 'Tente outra combinação ou limpe os filtros.' : 'Quando alguém publicar seu perfil musical, ele aparecerá nesta lista. Você também pode participar pela sua conta.'}</p></div>}
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">{visible.map(musician => <li key={musician.uid}><Link to={`/musicos/${encodeURIComponent(musician.uid)}`} state={{ from: '/musicos' + (key ? '?' + key : '') }} className="flex min-h-28 min-w-0 gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"><AccountAvatar user={{ uid: musician.uid, name: musician.name, email: '', photo: musician.photo }} className="size-14" /><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{musician.name}</h2><p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{[musician.location.city, musician.location.region].filter(Boolean).join(' · ') || 'Localização não informada'}</p><p className="mt-2 truncate text-sm text-chord">{musician.instruments.join(' · ') || 'Explorando a música'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{musician.styles.join(' · ')}</p><span className="mt-2 inline-block text-[11px] text-muted-foreground">{musician.acceptsInvites ? 'Disponível para convites' : 'Sem novos convites no momento'}</span></div><ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" /></Link></li>)}</ul>
    {loading && <div role="status" aria-label="Carregando músicos" className="mt-4 grid animate-pulse gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map(value => <div key={value} className="h-28 rounded-2xl bg-muted" />)}</div>}
    {online && loadedKey === key && page?.more && !error && <Button variant="outline" className="mt-5 w-full" disabled={loading} onClick={() => setRequest({ key, cursor: page.cursor })}>{loading ? 'Carregando…' : 'Carregar mais músicos'}</Button>}
  </section>;
};
