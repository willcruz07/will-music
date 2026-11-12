import { BookOpen, Check, CloudOff, Download, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { db } from '../lib/db.ts';
import { catalogArtistId, catalogArtistPath, type CatalogArtist, type CatalogChart, saveCatalogChart } from '../lib/catalogData.ts';
import type { ArtistPage, CatalogField, CatalogPage } from '../lib/cloud/catalog.ts';
import { useOnline } from '../lib/online.ts';
import { useAccount } from '../lib/account.ts';
import { rovingKeys } from '../lib/a11y.ts';
import { Button } from '../ui/Button.tsx';
import { LibraryBadge } from './LibraryCard.tsx';
import { CatalogArtistPhoto } from './CatalogArtistPhoto.tsx';
import { useCardReveal } from '../lib/useCardReveal.ts';

export const CatalogBrowser = ({ onSaved, artist }: { onSaved?: () => void; artist?: CatalogArtist }) => {
  const online = useOnline();
  const { user, ready } = useAccount();
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get('busca') ?? '';
  const urlField = !artist && params.get('por') === 'artista' ? 'artist' : 'title';
  const [search, setSearch] = useState(urlSearch);
  const [term, setTerm] = useState(urlSearch.trim());
  const [field, setField] = useState<CatalogField>(urlField);
  const [items, setItems] = useState<CatalogChart[]>([]);
  const [page, setPage] = useState<CatalogPage | null>(null);
  const [artistItems, setArtistItems] = useState<CatalogArtist[]>([]);
  const [artistPage, setArtistPage] = useState<ArtistPage | null>(null);
  const artistMode = !artist && field === 'artist';
  const revealRef = useCardReveal(`${field}:${term}:${artist?.slug ?? artist?.name ?? ''}:${artistItems.length}:${items.length}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const lock = useRef(false);
  useEffect(() => { setSearch(urlSearch); setField(urlField); }, [urlSearch, urlField]);
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 450); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (urlSearch === term && urlField === field) return;
    const next = new URLSearchParams(params);
    if (!artist) next.set('aba', 'catalogo');
    if (term) next.set('busca', term); else next.delete('busca');
    if (!artist && field === 'artist') next.set('por', 'artista'); else next.delete('por');
    setParams(next, { replace: true });
  }, [term, field]);
  const artistParams = new URLSearchParams({ ...(term ? { busca: term } : {}), ...(params.get('voltar') ? { voltar: params.get('voltar')! } : {}) });
  const returnUrl = artist ? `${catalogArtistPath(artist)}${artistParams.size ? `?${artistParams}` : ''}` : `/?${new URLSearchParams({ aba: 'catalogo', ...(term ? { busca: term } : {}), ...(field === 'artist' ? { por: 'artista' } : {}) })}`;
  useEffect(() => {
    let active = true;
    void db.songs.toArray().then(songs => { if (active) setSaved(new Map(songs.filter(s => s.catalogSource?.collection === 'cifras').map(s => [s.catalogSource!.id, s.id]))); }).catch(() => { if (active) setNotice('Não foi possível conferir as cifras salvas neste aparelho.'); });
    return () => { active = false; };
  }, []);
  const load = async (more: boolean, ticket: number) => {
    setLoading(true); setError(null);
    let failure = (e: unknown) => e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.';
    try {
      const api = await import('../lib/cloud/catalog.ts');
      failure = api.catalogError;
      if (artistMode) {
        const result = await api.listCatalogArtists(term, more ? artistPage?.cursor : null);
        if (ticket !== request.current) return;
        setArtistPage(result);
        setArtistItems(previous => more ? [...new Map([...previous, ...result.items].map(item => [catalogArtistId(item), item])).values()] : result.items);
        return;
      }
      const result = await api.listCatalog('title', term, more ? page?.cursor : null, artist);
      if (ticket !== request.current) return;
      setPage(result);
      setItems(previous => more ? [...new Map([...previous, ...result.items].map(item => [item.id, item])).values()] : result.items);
    } catch (e) { if (ticket === request.current) setError(failure(e)); }
    finally { if (ticket === request.current) { setLoading(false); lock.current = false; } }
  };
  useEffect(() => {
    const ticket = ++request.current;
    setItems([]); setPage(null); setArtistItems([]); setArtistPage(null); lock.current = true;
    if (!ready) { setLoading(true); return () => { request.current++; }; }
    void load(false, ticket);
    return () => { request.current++; };
  }, [term, field, ready, user?.uid, revision, artist?.slug, artist?.name]);
  const save = async (item: CatalogChart) => {
    if (saving) return;
    setSaving(item.id); setNotice(null);
    try { const song = await saveCatalogChart(item); setSaved(previous => new Map(previous).set(item.id, song.id)); setNotice(`“${item.title}” está na sua biblioteca e pode ser aberta offline.`); onSaved?.(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível salvar a cifra neste aparelho.'); }
    finally { setSaving(null); }
  };
  return <section id="library-catalog" className="mt-5 library-panel-enter" aria-label="Catálogo de cifras">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-surface p-4 sm:p-5">{artist ? <div className="flex min-w-0 items-center gap-4"><CatalogArtistPhoto artist={artist} className="size-20 sm:size-24" /><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-chord">Artista</p><h1 className="mt-1 break-words font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">{artist.name}</h1><p className="mt-2 text-sm text-muted-foreground">Explore as cifras deste artista e salve na sua biblioteca.</p></div></div> : <><div className="max-w-xl"><h2 className="text-xl font-semibold">Encontre sua próxima cifra</h2><p className="mt-1 text-sm text-muted-foreground">Explore o acervo, abra a cifra e salve suas favoritas na biblioteca para estudar sem internet.</p></div><Link to={user ? '/conta' : `/login?voltar=${encodeURIComponent(returnUrl)}`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-sm font-semibold text-chord">{user ? 'Minha conta' : 'Entrar'}</Link></>}</div>
    {!online && <p role="status" className="mt-4 flex items-start gap-2 text-sm text-muted-foreground"><CloudOff className="size-5 shrink-0" /> Você está offline. Resultados já abertos podem permanecer nesta sessão. Suas cifras salvas estão na aba Cifras.</p>}
    {!artist && <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Pesquisar catálogo por" onKeyDown={rovingKeys}>{(['title', 'artist'] as const).map(value => <button key={value} type="button" role="radio" aria-checked={field === value} onClick={() => setField(value)} className={`min-h-10 rounded-full border px-4 text-sm ${field === value ? 'border-primary bg-primary/10 font-semibold text-chord' : 'border-border'}`}>{value === 'title' ? 'Título' : 'Artistas'}</button>)}</div>}
    <label className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="size-5 shrink-0 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} aria-label={artist ? `Buscar cifras de ${artist.name}` : 'Buscar no catálogo'} placeholder={artist ? 'Pesquisar uma cifra deste artista' : field === 'title' ? 'Começo do título da música' : 'Começo do nome do artista'} className="h-12 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" /><span className="sr-only">Buscar no catálogo</span></label>
    <p className="mt-2 text-xs text-muted-foreground">A busca considera o início do nome. Confira também os acentos e as letras maiúsculas do cadastro.</p>
    {notice && <p role="status" className="mt-4 rounded-xl border border-border bg-surface p-3 text-sm">{notice}</p>}
    {error && <div role="alert" className="mt-4 rounded-xl border border-danger/30 p-4"><p className="text-sm">{error}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={loading} onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button><Link to={user ? '/conta' : `/login?voltar=${encodeURIComponent(returnUrl)}`} className="inline-flex min-h-10 items-center px-3 text-sm text-chord">Entrar na conta</Link></div></div>}
    <ul ref={revealRef} className="library-grid mt-5" aria-busy={loading} aria-label={artistMode ? 'Artistas do catálogo' : 'Cifras do catálogo'}>
      {artistMode && artistItems.map(item => <li key={catalogArtistId(item)} className="library-card library-card-chart"><Link aria-label={`Ver cifras de ${item.name}`} to={`${catalogArtistPath(item)}?voltar=${encodeURIComponent(returnUrl)}`} className="flex h-full flex-col items-center p-5 text-center"><CatalogArtistPhoto artist={item} className="size-24 sm:size-28" /><h3 className="mt-4 break-words text-base font-semibold">{item.name}</h3><span className="mt-auto pt-4 text-sm font-semibold text-chord">Ver cifras</span></Link></li>)}
      {!artistMode && items.map(item => <li key={item.id} className="library-card library-card-chart p-3 sm:p-4">
        <Link to={`/catalogo/${encodeURIComponent(item.id)}?voltar=${encodeURIComponent(returnUrl)}`} className="flex min-w-0 flex-1 flex-col"><BookOpen className="size-6 text-chord" /><h3 className="mt-4 line-clamp-2 min-h-12 break-words text-base font-semibold leading-6">{item.title}</h3><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.artist || 'Artista não informado'}</p><div className="mt-4 flex flex-wrap gap-2">{item.key && <LibraryBadge>Tom {item.key}</LibraryBadge>}{item.style && <LibraryBadge>{item.style}</LibraryBadge>}</div><span className="mt-auto inline-flex min-h-11 items-center gap-2 pt-4 text-sm font-semibold text-chord">Ler cifra</span></Link>
        {saved.has(item.id) ? <Link to={`/musica/${saved.get(item.id)}`} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 px-2 text-center text-xs font-semibold text-chord"><Check className="size-4 shrink-0" /> Na biblioteca</Link> : <Button className="mt-2 min-h-11 w-full px-2 text-xs" disabled={saving !== null || !item.content.trim()} onClick={() => void save(item)}><Download className="size-4 shrink-0" /> {saving === item.id ? 'Salvando…' : 'Salvar cifra'}</Button>}
      </li>)}
      {loading && (artistMode ? artistItems.length : items.length) === 0 && Array.from({ length: 6 }, (_, index) => <li key={`loading-${index}`} aria-hidden className="h-64 animate-pulse rounded-2xl border border-border bg-surface p-4"><div className="size-8 rounded-lg bg-muted" /><div className="mt-5 h-5 w-3/4 rounded bg-muted" /><div className="mt-3 h-3 w-1/2 rounded bg-muted" /></li>)}
    </ul>
    {loading && <p role="status" className="mt-4 text-sm text-muted-foreground">{artistMode ? 'Buscando artistas…' : 'Buscando cifras…'}</p>}
    {!loading && !error && (artistMode ? artistItems.length : items.length) === 0 && <p className="mt-6 text-sm text-muted-foreground">{artistMode ? 'Nenhum artista encontrado. Experimente outro início de nome.' : artist ? 'Nenhuma cifra encontrada para esta busca dentro do artista.' : 'Nenhuma cifra encontrada. Experimente outro início de título.'}</p>}
    {(artistMode ? artistPage?.more : page?.more) && !error && <Button variant="outline" className="mt-6 min-h-11 w-full" disabled={loading} onClick={() => { if (lock.current) return; lock.current = true; void load(true, request.current); }}>{loading ? 'Carregando…' : artistMode ? 'Carregar mais artistas' : 'Carregar mais cifras'}</Button>}
    <p className="mt-6 text-xs text-muted-foreground">Salvar cria uma cópia neste aparelho. Suas edições ficam na biblioteca e não modificam o catálogo.</p>
  </section>;
};
