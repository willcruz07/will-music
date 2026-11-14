import { ArrowLeft, Download, Minus, Pencil, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ChartView } from '../components/ChartView.tsx';
import { ChordHelp } from '../components/ChordHelp.tsx';
import { catalogArtistPath, type CatalogChart as CatalogItem, findSavedCatalogChart, saveCatalogChart } from '../lib/catalogData.ts';
import { prefersFlats, transposeKey } from '../lib/transpose.ts';
import { useOnline } from '../lib/online.ts';
import { Button, IconButton } from '../ui/Button.tsx';

export const CatalogChart = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedReturn = params.get('voltar') || '';
  const returnUrl = requestedReturn.startsWith('/?aba=catalogo') || requestedReturn.startsWith('/catalogo/artista/') ? requestedReturn : '/?aba=catalogo';
  const online = useOnline();
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [transpose, setTranspose] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [help, setHelp] = useState<{ chord: string; anchor: DOMRect } | null>(null);
  useEffect(() => {
    let active = true;
    setItem(null); setError(null); setSaveError(null); setSavedId(null); setTranspose(0); setHelp(null);
    void (async () => {
      const local = await findSavedCatalogChart(id).catch(() => undefined);
      if (!active) return;
      if (local) { setSavedId(local.id); if (!navigator.onLine) { navigate(`/musica/${local.id}`, { replace: true }); return; } }
      let failure = (e: unknown) => e instanceof Error ? e.message : 'Não foi possível abrir a cifra.';
      try { const api = await import('../lib/cloud/catalog.ts'); failure = api.catalogError; const result = await api.getCatalogChart(id); if (active) setItem(result); }
      catch (e) { if (active) setError(failure(e)); }
    })();
    return () => { active = false; };
  }, [id, revision]);
  const key = item?.key ? transposeKey(item.key, transpose) : undefined;
  return <section>
    <Link to={returnUrl} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" /> Catálogo</Link>
    {error ? <div role="alert" className="mt-5 rounded-2xl border border-border bg-surface p-5"><p>{error}</p><div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" onClick={() => setRevision(v => v + 1)}>Tentar novamente</Button>{savedId && <Link to={`/musica/${savedId}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-chord">Abrir cópia salva</Link>}<Link to={`/login?voltar=${encodeURIComponent(`/catalogo/${encodeURIComponent(id)}`)}`} className="inline-flex min-h-10 items-center text-sm text-chord">Entrar</Link></div></div> : !item ? <div role="status" className="mt-5 animate-pulse rounded-2xl border border-border bg-surface p-5">Preparando a cifra…</div> : <>
      <header className="mt-4 rounded-2xl border border-border bg-surface p-5"><p className="text-xs font-semibold uppercase tracking-widest text-chord">Catálogo de cifras</p><h1 className="mt-2 break-words font-[family-name:var(--font-display)] text-3xl font-semibold">{item.title}</h1><p className="mt-2 text-muted-foreground">{item.artistRef ? <Link className="font-semibold text-chord hover:underline" to={catalogArtistPath(item.artistRef)}>{item.artist}</Link> : item.artist || 'Artista não informado'}</p><div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-chord">{key ? `Tom ${key}` : 'Tom não informado'}</span>{item.style && <span className="text-sm text-muted-foreground">{item.style}</span>}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><div className="inline-flex items-center rounded-xl border border-border"><IconButton label="Transpor meio tom abaixo" disabled={transpose <= -12} onClick={() => { setHelp(null); setTranspose(v => v - 1); }}><Minus className="size-4" /></IconButton><span className="min-w-16 px-2 text-center text-sm tabular-nums">{transpose > 0 ? '+' : ''}{transpose} st</span><IconButton label="Transpor meio tom acima" disabled={transpose >= 12} onClick={() => { setHelp(null); setTranspose(v => v + 1); }}><Plus className="size-4" /></IconButton></div><label className="ml-1 flex items-center gap-2 text-sm">Letra<input aria-label="Tamanho da letra" type="range" min={14} max={28} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-24 accent-primary" /></label>
      {savedId ? <Link to={`/musica/${savedId}`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Abrir na biblioteca</Link> : <Button disabled={saving || !item.chordPro.trim()} onClick={() => {
        setSaving(true); setSaveError(null);
        void saveCatalogChart(item, transpose, fontSize).then(song => { setSavedId(song.id); }).catch(e => setSaveError(e instanceof Error ? e.message : 'Não foi possível salvar a cifra.')).finally(() => setSaving(false));
      }}><Download className="size-4" /> {saving ? 'Salvando…' : 'Salvar na biblioteca'}</Button>}
      <Button variant="outline" disabled={saving || !item.chordPro.trim()} onClick={() => {
        if (savedId) { navigate(`/musica/${savedId}/editar`); return; }
        setSaving(true); setSaveError(null);
        void saveCatalogChart(item, transpose, fontSize).then(song => { setSavedId(song.id); navigate(`/musica/${song.id}/editar`); }).catch(error => setSaveError(error instanceof Error ? error.message : 'Não foi possível preparar a edição.')).finally(() => setSaving(false));
      }}><Pencil className="size-4" />Editar em ChordPro</Button></div>
      <p className="mt-3 text-xs text-muted-foreground">{savedId ? 'Sua cópia local está disponível offline. Edições anteriores foram preservadas.' : 'Salve para abrir offline e usar edição, impressão e listas na biblioteca.'}{!online ? ' Você está offline.' : ''}</p></header>
      {saveError && <p role="alert" className="mt-3 rounded-xl border border-danger/30 p-3 text-sm text-danger">{saveError} A cifra continua aberta; você pode tentar salvar novamente.</p>}
      <div className="mt-6 min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6">{item.chordPro.trim() ? <ChartView chordPro={item.chordPro} transpose={transpose} preferFlats={key ? prefersFlats(key) : false} spellKey={key} fontSize={fontSize} onChordTap={(chord, anchor) => setHelp({ chord, anchor })} /> : <p className="text-muted-foreground">Esta cifra ainda não tem conteúdo disponível.</p>}</div>
      {help && <ChordHelp key={help.chord} chord={help.chord} anchor={help.anchor} onClose={() => setHelp(null)} strict />}
    </>}
  </section>;
};
