import { LIBRARY_CHANGED } from '../lib/sharingTypes.ts';
import { AudioLines, FileText, FolderOpen, Globe, Music4, Search } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AboutButton } from '../components/About.tsx';
import { ScrollStrip } from '../components/ScrollStrip.tsx';
import { Link, useSearchParams } from 'react-router';
import { Scores } from './Scores.tsx';
import { ImportButton } from '../components/PackageButtons.tsx';
import { type Chart, type Song, db, deleteSong, listSongs } from '../lib/db.ts';
import { confirmDialog } from '../ui/Dialog.tsx';
import { rovingKeys } from '../lib/a11y.ts';
import { LibraryCard, LibraryBadge } from '../components/LibraryCard.tsx';
import { chartCardInfo, durationLabel } from '../lib/libraryCards.ts';
import { useCardReveal } from '../lib/useCardReveal.ts';
import { LibraryEmptyState } from '../components/LibraryEmptyState.tsx';
import { Button } from '../ui/Button.tsx';
import { isMobileStudio } from '../lib/studioDevice.ts';

const STATUS: Record<Song['analysisStatus'], string | null> = {
  pending: 'Aguardando análise',
  running: 'Analisando…',
  done: null,
  error: 'Análise com erro',
};

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const CatalogBrowser = lazy(() => import('../components/CatalogBrowser.tsx').then(m => ({ default: m.CatalogBrowser })));

export const Library = () => {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') === 'catalogo' ? 'catalog' : params.get('aba') === 'partituras' ? 'scores' : params.get('aba') === 'cifras' ? 'charts' : 'studio';
  const [audioIds, setAudioIds] = useState<Set<string>>(new Set());
  const [chartIds, setChartIds] = useState<Set<string>>(new Set());
  const [chartsBySong, setChartsBySong] = useState<Map<string, Chart>>(new Map());
  const [scoreIds, setScoreIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [scoresRevision, setScoresRevision] = useState(0);
  const refresh = async () => {
    const [list, ids, charts, scores] = await Promise.all([listSongs(), db.audio.toCollection().primaryKeys(), db.charts.toArray(), db.scores.toCollection().primaryKeys()]);
    setAudioIds(new Set(ids)); setChartIds(new Set(charts.map(c => c.songId))); setChartsBySong(new Map(charts.map(c => [c.songId, c]))); setScoreIds(new Set(scores)); setSongs(list);
    setScoresRevision(previous => previous + 1);
  };
  // null = every song, '' = songs without a folder.
  const [folder, setFolder] = useState<string | null>(null);

  useEffect(() => {
    const changed = () => { void refresh().catch(() => {}); };
    window.addEventListener(LIBRARY_CHANGED, changed);
    void refresh().catch(e => setNotice(e instanceof Error ? e.message : 'Não foi possível carregar a biblioteca.'));
    return () => window.removeEventListener(LIBRARY_CHANGED, changed);
  }, []);

  const collection = useMemo(() => (songs ?? []).filter(s => tab === 'studio' ? audioIds.has(s.id) : !audioIds.has(s.id) && chartIds.has(s.id)), [songs, tab, audioIds, chartIds]);
  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return collection.filter(s => (folder === null || (s.folder ?? '') === folder) && (!q || normalize(`${s.title} ${s.artist}`).includes(q)));
  }, [collection, query, folder]);

  const revealRef = useCardReveal(`${tab}:${visible.map(song => song.id).join(',')}`);
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of collection) counts.set(s.folder ?? '', (counts.get(s.folder ?? '') ?? 0) + 1);
    return [...counts.entries()].sort(([a], [z]) => (a === '' ? 1 : z === '' ? -1 : a.localeCompare(z)));
  }, [collection]);
  const counts = { catalog: '', studio: (songs ?? []).filter(s => audioIds.has(s.id)).length, charts: (songs ?? []).filter(s => !audioIds.has(s.id) && chartIds.has(s.id)).length, scores: (songs ?? []).filter(s => scoreIds.has(s.id)).length };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Biblioteca</h1>
        <div className="flex flex-wrap gap-2">
        <Link to="/pasta" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted">
          <FolderOpen className="size-4" /> Minha pasta
        </Link>
        <ImportButton
          onImported={(message) => {
            setNotice(message);
            void refresh().catch(e => setNotice(String(e)));
          }}
        />
        </div>
      </div>
      {notice && <p className="mt-3 text-sm" role="status">{notice}</p>}
      <p className="mt-2 text-sm text-muted-foreground">Seu espaço para ouvir, estudar e tocar.</p>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" role="tablist" aria-label="Biblioteca" onKeyDown={rovingKeys}>
        {([{ value: 'studio', label: 'Estúdio', description: 'Áudio e mixagem', icon: AudioLines }, { value: 'charts', label: 'Cifras', description: 'Letras e acordes', icon: FileText }, { value: 'scores', label: 'Partituras', description: 'Notas e instrumentos', icon: Music4 }, { value: 'catalog', label: 'Catálogo', description: 'Descobrir novas cifras', icon: Globe }] as const).map(({ value, label, description, icon: Icon }) => <button key={value} type="button" role="tab" aria-label={label} aria-selected={tab === value} aria-controls={value === 'catalog' ? 'library-catalog' : value === 'scores' ? 'library-scores' : 'library-items'} onClick={() => { setFolder(null); const next = new URLSearchParams(params); if (value === 'studio') next.delete('aba'); else next.set('aba', value === 'catalog' ? 'catalogo' : value === 'charts' ? 'cifras' : 'partituras'); setParams(next, { replace: true }); }} className={`library-tab ${tab === value ? 'is-current' : ''}`}><span className="flex w-full items-center justify-between gap-1"><Icon className="size-5" aria-hidden /><span className="text-xs tabular-nums opacity-70" aria-hidden>{counts[value]}</span></span><span className="mt-3 block text-sm font-semibold">{label}</span><span className="mt-1 hidden text-xs text-muted-foreground sm:block">{description}</span></button>)}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{tab === 'catalog' ? 'Cifras do acervo Alt7 para descobrir, ler e salvar neste aparelho.' : tab === 'studio' ? 'Áudios originais para explorar faixas, letras e harmonia.' : tab === 'charts' ? 'Suas cifras salvas, com os tons e as formações que você escolheu.' : 'Partituras prontas para abrir, tocar e imprimir, sem reprocessar o áudio.'}</p>

      {tab !== 'catalog' && songs && songs.length > 0 && (
        <label className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por música ou artista"
            aria-label="Buscar"
            className="h-11 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
      )}

      {tab !== 'scores' && tab !== 'catalog' && folders.length > 1 && (
        <ScrollStrip className="mt-3" role="group" label="Pastas" selected={folder} innerClassName="gap-2 pb-1">
          {[[null, 'Todas', collection.length] as const, ...folders.map(([f, n]) => [f, f || 'Sem pasta', n] as const)].map(([value, label, count]) => (
            <button
              key={value ?? '__all__'}
              type="button"
              aria-pressed={folder === value}
              onClick={() => setFolder(value)}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${folder === value ? 'border-primary bg-primary/15 font-semibold text-chord' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              {label} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </ScrollStrip>
      )}

      {tab !== 'scores' && tab !== 'catalog' && songs && collection.length === 0 && (
        <LibraryEmptyState section={tab === 'studio' ? 'Estúdio' : 'Cifras'} title={tab === 'studio' ? 'Seu próximo estudo começa com uma música' : 'Reúna as cifras que você quer tocar'}
          description={tab === 'studio' ? (isMobileStudio() ? 'Importe um MP3 para ouvir, identificar o tom e explorar os acordes. Seus áudios ficam organizados nesta aba.' : 'Importe um MP3 para explorar acordes, letras e faixas no Estúdio. Seus áudios ficam organizados nesta aba.') : 'As cifras que você salvar aparecem aqui, prontas para ler, transpor e estudar. Encontre uma no catálogo ou crie a sua sem precisar de áudio.'}>
          <Link to={tab === 'studio' ? '/nova' : '/?aba=catalogo'} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-105">{tab === 'studio' ? 'Importar áudio' : 'Explorar catálogo'}</Link>
          {tab === 'charts' && <Link to="/nova" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold text-chord hover:bg-muted">Criar minha cifra</Link>}
        </LibraryEmptyState>
      )}

      {tab === 'catalog' && <Suspense fallback={<p role="status" className="mt-6 animate-pulse text-muted-foreground">Preparando o catálogo…</p>}><CatalogBrowser /></Suspense>}
      {tab === 'scores' && <div id="library-scores"><Scores embedded query={query} onClearSearch={() => setQuery('')} revision={scoresRevision} onDeleted={() => void refresh().catch(e => setNotice(String(e)))} /></div>}
      {tab !== 'scores' && tab !== 'catalog' && <ul ref={revealRef} key={tab} id="library-items" className="library-grid mt-5 library-panel-enter">
        {visible.map(song => {
          const chart = chartsBySong.get(song.id);
          const info = chartCardInfo(song, chart);
          const duration = durationLabel(song.durationSec);
          return <LibraryCard key={song.id} kind={tab === 'studio' ? 'studio' : 'chart'} title={song.title} artist={song.artist} to={`/musica/${song.id}`}
            description={tab === 'studio' ? 'Áudio original para estudo, separação de faixas e mixagem.' : info.preview}
            badges={tab === 'studio' ? <><LibraryBadge>Áudio</LibraryBadge>{duration && <LibraryBadge>{duration}</LibraryBadge>}</> : <><span className="library-key" aria-label={`Tom ${info.key ?? 'não informado'}`}><span>Tom</span><strong>{info.key ?? '—'}</strong></span>{info.transpose !== 0 && <LibraryBadge>Transp. {info.transpose > 0 ? '+' : ''}{info.transpose}</LibraryBadge>}</>}
            metadata={<>{tab === 'studio' && song.tempo ? <span>≈ {song.tempo} BPM</span> : null}{song.capo ? <span>Capo {song.capo}</span> : null}{tab === 'charts' && chart?.chordInstrument && <span>{chart.chordInstrument === 'violao' ? 'Violão' : chart.chordInstrument === 'teclado' ? 'Teclado' : 'Cavaquinho'}</span>}{tab === 'charts' && STATUS[song.analysisStatus] && <span>{STATUS[song.analysisStatus]}</span>}</>}
            deleteLabel={`Excluir “${song.title}”`} deleting={!!deleting} onDelete={() => void confirmDialog({ title: tab === 'studio' ? 'Excluir áudio?' : 'Excluir cifra?', message: tab === 'studio' ? `“${song.title}” será removida com seu áudio e dados de estudo. Cifras e partituras salvas separadamente permanecem.` : `A cifra “${song.title}” e suas formações serão removidas. Áudios e partituras independentes permanecem.`, confirmLabel: 'Excluir' }).then(async ok => {
              if (!ok) return;
              setDeleting(song.id);
              try { await deleteSong(song.id); setSongs(previous => previous?.filter(s => s.id !== song.id) ?? null); }
              catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível excluir o item.'); }
              finally { setDeleting(null); }
            })} />;
        })}
      </ul>}
      {tab !== 'scores' && tab !== 'catalog' && songs && collection.length > 0 && visible.length === 0 && <LibraryEmptyState section={tab === 'studio' ? 'Estúdio' : 'Cifras'} title="Nenhum resultado com estes filtros" description={query.trim() ? `Não encontramos itens para “${query.trim()}” nesta seleção. Tente outro nome ou limpe os filtros para ver sua coleção.` : 'Não há itens nesta pasta. Limpe os filtros para voltar à sua coleção.'}><Button variant="outline" onClick={() => { setQuery(''); setFolder(null); }}>Limpar filtros</Button></LibraryEmptyState>}

      <AboutButton autoOpenOnce />
    </section>
  );
};
