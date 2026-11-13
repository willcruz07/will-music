import { useEffect, useState } from 'react';
import type { CatalogFilters, StylePage } from '../lib/cloud/catalog.ts';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';

export const CatalogFiltersSheet = ({ value, onApply, onClose }: { value: CatalogFilters; onApply: (value: CatalogFilters) => void; onClose: () => void }) => {
  const [draft, setDraft] = useState(value);
  const [styles, setStyles] = useState<string[]>([]);
  const [page, setPage] = useState<StylePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<{ cursor: string | null; revision: number }>({ cursor: null, revision: 0 });
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void import('../lib/cloud/catalog.ts').then(async api => {
      try {
        const result = await api.listCatalogStyles(request.cursor);
        if (active) { setStyles(previous => [...new Set([...previous, ...result.items])]); setPage(result); }
      } catch (error) { if (active) setError(api.catalogError(error)); }
    }).catch(() => { if (active) setError('Não foi possível carregar os estilos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [request]);
  const choice = (selected: boolean) => `min-h-11 rounded-xl border px-3 text-sm ${selected ? 'border-primary bg-primary/15 font-semibold text-chord' : 'border-border bg-surface text-muted-foreground'}`;
  return <BottomSheet title="Filtrar catálogo" onClose={onClose}>{() => <div className="overflow-y-auto overscroll-contain px-4 pb-5">
    <fieldset><legend className="mb-2 font-semibold">Ordem alfabética</legend><div className="flex gap-2">
      <button className={choice(!draft.descending)} aria-pressed={!draft.descending} onClick={() => setDraft(v => ({ ...v, descending: false }))}>A–Z</button>
      <button className={choice(!!draft.descending)} aria-pressed={!!draft.descending} onClick={() => setDraft(v => ({ ...v, descending: true }))}>Z–A</button>
    </div><p className="mt-2 text-xs text-muted-foreground">A letra segue a grafia do cadastro, incluindo acentos e maiúsculas.</p></fieldset>
    <fieldset className="mt-5"><legend className="mb-2 font-semibold">Letra inicial</legend><div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
      {['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(letter => <button key={letter} className={choice((draft.letter ?? '') === letter)} aria-label={letter ? `Começa com ${letter}` : 'Todas as letras'} aria-pressed={(draft.letter ?? '') === letter} onClick={() => setDraft(v => ({ ...v, letter }))}>{letter || 'Todas'}</button>)}
    </div></fieldset>
    <fieldset className="mt-5"><legend className="mb-2 font-semibold">Estilo musical</legend><div className="flex flex-wrap gap-2">
      {['', ...new Set([...(value.style ? [value.style] : []), ...styles])].map(style => <button key={style} className={choice((draft.style ?? '') === style)} aria-pressed={(draft.style ?? '') === style} onClick={() => setDraft(v => ({ ...v, style }))}>{style || 'Todos os estilos'}</button>)}
    </div>{loading && <p className="mt-3 text-sm text-muted-foreground" role="status">Carregando estilos do catálogo…</p>}
      {error && <div className="mt-3 text-sm" role="alert"><p>{error}</p><Button className="mt-2" variant="outline" onClick={() => setRequest(v => ({ ...v, revision: v.revision + 1 }))}>Tentar novamente</Button></div>}
      {page?.more && !loading && !error && <Button className="mt-3" variant="outline" onClick={() => setRequest(v => ({ cursor: page.cursor, revision: v.revision + 1 }))}>Carregar mais estilos</Button>}
    </fieldset>
    <div className="sticky bottom-0 mt-6 flex gap-2 border-t border-border bg-surface pb-1 pt-3"><Button className="flex-1" variant="outline" onClick={() => setDraft({})}>Limpar filtros</Button><Button className="flex-1" onClick={() => onApply(draft)}>Aplicar filtros</Button></div>
  </div>}</BottomSheet>;
};
