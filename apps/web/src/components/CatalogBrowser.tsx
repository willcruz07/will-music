import { ChevronRight, CloudOff, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { catalogArtistId, catalogArtistPath, type CatalogArtist, type CatalogChart } from '../lib/catalogData.ts';
import type { ArtistPage, CatalogField, CatalogFilters, CatalogPage } from '../lib/cloud/catalog.ts';
import { useOnline } from '../lib/online.ts';
import { useAccount } from '../lib/account.ts';
import { rovingKeys } from '../lib/a11y.ts';
import { Button } from '../ui/Button.tsx';
import { CatalogArtistPhoto } from './CatalogArtistPhoto.tsx';
import { CatalogFiltersSheet } from './CatalogFiltersSheet.tsx';
import { useCardReveal } from '../lib/useCardReveal.ts';

export const CatalogBrowser = ({ artist }: { artist?: CatalogArtist }) => {
  const online = useOnline();
  const { user, ready } = useAccount();
  const [params, setParams] = useSearchParams();
  const term = params.get('busca')?.trim() ?? '';
  const field: CatalogField = !artist && params.get('por') === 'artista' ? 'artist' : 'title';
  const letter = /^[A-Z]$/u.test(params.get('letra') ?? '') ? params.get('letra')! : '';
  const style = params.get('estilo') ?? '';
  const descending = params.get('ordem') === 'za';
  const filters: CatalogFilters = { letter, style, descending };
  const [search, setSearch] = useState(term);
  const [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<CatalogChart[]>([]);
  const [page, setPage] = useState<CatalogPage | null>(null);
  const [artistItems, setArtistItems] = useState<CatalogArtist[]>([]);
  const [artistPage, setArtistPage] = useState<ArtistPage | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const artistMode = !artist && field === 'artist';
  const revealRef = useCardReveal(`${field}:${term}:${letter}:${style}:${descending}:${artistItems.length}:${items.length}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const lock = useRef(false);
  useEffect(() => { setSearch(term); }, [term]);
  useEffect(() => {
    if (search.trim() === term) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search.trim()) next.set('busca', search.trim()); else next.delete('busca');
      setParams(next, { replace: true });
    }, 450);
    return () => clearTimeout(timer);
  }, [search, term, params, setParams]);
  const routeParams = new URLSearchParams(params);
  if (!artist) routeParams.set('aba', 'catalogo');
  const returnUrl = artist ? `${catalogArtistPath(artist)}?${routeParams}` : `/?${routeParams}`;
  const applyFilters = (value: CatalogFilters) => {
    const next = new URLSearchParams(params);
    if (value.letter) next.set('letra', value.letter); else next.delete('letra');
    if (value.style) next.set('estilo', value.style); else next.delete('estilo');
    if (value.descending) next.set('ordem', 'za'); else next.delete('ordem');
    setParams(next, { replace: true }); setFilterOpen(false);
  };
  const load = async (more: boolean, ticket: number) => {
    setLoading(true); setError(null);
    let failure = (e: unknown) => e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.';
    try {
      const api = await import('../lib/cloud/catalog.ts'); failure = api.catalogError;
      if (artistMode) {
        const result = await api.listCatalogArtists(term, more ? artistPage?.cursor : null, filters);
        if (ticket !== request.current) return;
        setArtistPage(result);
        setArtistItems(previous => more ? [...new Map([...previous, ...result.items].map(item => [catalogArtistId(item), item])).values()] : result.items);
      } else {
        const result = await api.listCatalog('title', term, more ? page?.cursor : null, artist, filters);
        if (ticket !== request.current) return;
        setPage(result);
        setItems(previous => more ? [...new Map([...previous, ...result.items].map(item => [item.id, item])).values()] : result.items);
      }
    } catch (e) { if (ticket === request.current) setError(failure(e)); }
    finally { if (ticket === request.current) { setLoading(false); lock.current = false; } }
  };
  useEffect(() => {
    const ticket = ++request.current;
    setItems([]); setPage(null); setArtistItems([]); setArtistPage(null); lock.current = true;
    if (ready) void load(false, ticket); else setLoading(true);
    return () => { request.current++; };
  }, [term, field, letter, style, descending, ready, user?.uid, revision, artist?.slug, artist?.name]);
  useEffect(() => {
    if (!artistMode || !online || !artistItems.length) return;
    let active = true;
    void (async () => {
      const api = await import('../lib/cloud/catalog.ts');
      for (let index = 0; active && index < artistItems.length; index += 3) {
        await Promise.all(artistItems.slice(index, index + 3).map(async item => {
          try {
            const count = await api.countCatalogArtist(item, style);
            if (active) setCounts(previous => ({ ...previous, [JSON.stringify([catalogArtistId(item), style])]: count }));
          } catch (error) { if (active) console.warn('Contagem de cifras do artista indisponível', error); }
        }));
      }
    })().catch(error => { if (active) console.warn('Contagens do catálogo indisponíveis', error); });
    return () => { active = false; };
  }, [artistMode, artistItems, style, online]);
  const filterLabels = [letter && `Letra ${letter}`, style, descending && 'Z–A'].filter(Boolean);
  const hasFilters = filterLabels.length > 0;
  const size = artistMode ? artistItems.length : items.length;
  return <section id="library-catalog" className="mt-4" aria-label="Catálogo de cifras">
    {artist && <header className="mb-4 flex min-w-0 items-center gap-3"><CatalogArtistPhoto artist={artist} className="size-14" /><div className="min-w-0"><p className="text-xs text-muted-foreground">Cifras de</p><h1 className="break-words text-xl font-semibold">{artist.name}</h1></div></header>}
    <div className="catalog-search-sticky">
      {!artist && <div className="mb-2 flex gap-1" role="radiogroup" aria-label="Pesquisar catálogo por" onKeyDown={rovingKeys}>{(['title', 'artist'] as const).map(value => <button key={value} type="button" role="radio" aria-checked={field === value} onClick={() => {
        const next = new URLSearchParams(params); if (value === 'artist') next.set('por', 'artista'); else next.delete('por'); setParams(next, { replace: true });
      }} className={`min-h-10 rounded-xl px-4 text-sm ${field === value ? 'bg-primary/15 font-semibold text-chord' : 'text-muted-foreground hover:bg-muted'}`}>{value === 'title' ? 'Título' : 'Artistas'}</button>)}</div>}
      <div className="flex min-w-0 gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} aria-label={artist ? `Buscar cifras de ${artist.name}` : 'Buscar no catálogo'} placeholder={artist || field === 'title' ? 'Buscar título' : 'Buscar artista'} className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>
        <Button variant="outline" aria-label={hasFilters ? `Filtros: ${filterLabels.join(', ')}` : 'Filtros'} title={hasFilters ? filterLabels.join(' · ') : 'Filtrar catálogo'} aria-haspopup="dialog" aria-expanded={filterOpen} className={`max-w-[48%] shrink-0 gap-1.5 px-3 ${hasFilters ? 'border-primary text-chord' : ''}`} onClick={() => setFilterOpen(true)}><SlidersHorizontal className="size-4 shrink-0" /><span className="truncate">{hasFilters ? filterLabels.join(' · ') : 'Filtros'}</span></Button>
      </div>
      {hasFilters && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 break-words text-xs text-chord">{filterLabels.join(' · ')}</span><button className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground" onClick={() => applyFilters({})}><X className="size-3" />Limpar filtros</button></div>}
    </div>
    {!online && <p role="status" className="mt-3 flex gap-2 text-sm text-muted-foreground"><CloudOff className="size-4 shrink-0" /> Você está offline. Abra suas cifras salvas na biblioteca.</p>}
    {error && <div role="alert" className="mt-3 rounded-xl border border-danger/30 p-3"><p className="text-sm">{error}</p><Button className="mt-2" variant="outline" disabled={loading} onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button></div>}
    <div className="mt-3 flex justify-between gap-2 text-xs text-muted-foreground"><span>{size ? `${size} ${artistMode ? 'artistas carregados' : 'cifras carregadas'}` : 'Catálogo'}</span><span>{descending ? 'Z–A' : 'A–Z'}</span></div>
    <ul ref={revealRef} className="catalog-results mt-2" aria-busy={loading} aria-label={artistMode ? 'Artistas do catálogo' : 'Cifras do catálogo'}>
      {artistMode && artistItems.map(item => {
        const count = counts[JSON.stringify([catalogArtistId(item), style])];
        return <li key={catalogArtistId(item)} className="catalog-result"><Link aria-label={`Ver cifras de ${item.name}`} to={`${catalogArtistPath(item)}?${new URLSearchParams({ voltar: returnUrl, ...(style ? { estilo: style } : {}) })}`} className="catalog-result-link">
          <CatalogArtistPhoto artist={item} className="size-12 sm:size-14" /><div className="min-w-0 flex-1"><h3 className="line-clamp-2 break-words text-sm font-semibold">{item.name}</h3><p className="mt-1 text-xs text-muted-foreground">{count === undefined ? 'Ver cifras' : `${count} ${count === 1 ? 'cifra' : 'cifras'}${style ? ` · ${style}` : ''}`}</p></div><ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link></li>;
      })}
      {!artistMode && items.map(item => <li key={item.id} className="catalog-result"><Link to={`/catalogo/${encodeURIComponent(item.id)}?voltar=${encodeURIComponent(returnUrl)}`} className="catalog-result-link">
        <CatalogArtistPhoto artist={item.artistRef ?? { name: item.artist, photo: '', slug: '' }} className="size-12 sm:size-14" /><div className="min-w-0 flex-1"><h3 className="line-clamp-2 break-words text-sm font-semibold">{item.title}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{item.artist || 'Artista não informado'}</p><p className="mt-1 flex min-w-0 gap-2 text-xs">{item.key && <span className="shrink-0 font-semibold text-chord">Tom {item.key}</span>}{item.style && <span className="truncate text-muted-foreground">{item.style}</span>}</p></div><ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link></li>)}
      {loading && !size && Array.from({ length: 10 }, (_, index) => <li key={`loading-${index}`} aria-hidden className="catalog-result flex items-center gap-3 p-3 motion-safe:animate-pulse"><div className="size-12 shrink-0 rounded-full bg-muted" /><div className="flex-1"><div className="h-4 w-3/4 rounded bg-muted" /><div className="mt-2 h-3 w-1/2 rounded bg-muted" /></div></li>)}
    </ul>
    {loading && <p role="status" className="mt-3 text-sm text-muted-foreground">{artistMode ? 'Buscando artistas…' : 'Buscando cifras…'}</p>}
    {!loading && !error && !size && <p className="mt-5 text-sm text-muted-foreground">Nenhum resultado com esta busca e estes filtros.</p>}
    {(artistMode ? artistPage?.more : page?.more) && !error && <Button variant="outline" className="mt-4 min-h-11 w-full" disabled={loading} onClick={() => { if (lock.current) return; lock.current = true; void load(true, request.current); }}>{loading ? 'Carregando…' : artistMode ? 'Carregar mais artistas' : 'Carregar mais cifras'}</Button>}
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">A pesquisa considera o início do nome e a grafia do cadastro, incluindo acentos e maiúsculas. Abra uma cifra para ler e salvar na biblioteca.</p>
    {filterOpen && <CatalogFiltersSheet value={filters} onApply={applyFilters} onClose={() => setFilterOpen(false)} />}
  </section>;
};
