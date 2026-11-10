import { AudioLines, FileText, FolderOpen, Music, Music4, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

const STATUS: Record<Song['analysisStatus'], string | null> = {
  pending: 'Aguardando análise',
  running: 'Analisando…',
  done: null,
  error: 'Análise com erro',
};

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const Library = () => {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') === 'partituras' ? 'scores' : params.get('aba') === 'cifras' ? 'charts' : 'studio';
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
    void refresh().catch(e => setNotice(e instanceof Error ? e.message : 'Não foi possível carregar a biblioteca.'));
  }, []);

  const collection = useMemo(() => (songs ?? []).filter(s => tab === 'studio' ? audioIds.has(s.id) : !audioIds.has(s.id) && chartIds.has(s.id)), [songs, tab, audioIds, chartIds]);
  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return collection.filter(s => (folder === null || (s.folder ?? '') === folder) && (!q || normalize(`${s.title} ${s.artist}`).includes(q)));
  }, [collection, query, folder]);

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of collection) counts.set(s.folder ?? '', (counts.get(s.folder ?? '') ?? 0) + 1);
    return [...counts.entries()].sort(([a], [z]) => (a === '' ? 1 : z === '' ? -1 : a.localeCompare(z)));
  }, [collection]);
  const counts = { studio: (songs ?? []).filter(s => audioIds.has(s.id)).length, charts: (songs ?? []).filter(s => !audioIds.has(s.id) && chartIds.has(s.id)).length, scores: (songs ?? []).filter(s => scoreIds.has(s.id)).length };

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
      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3" role="tablist" aria-label="Biblioteca" onKeyDown={rovingKeys}>
        {([{ value: 'studio', label: 'Estúdio', description: 'Áudio e mixagem', icon: AudioLines }, { value: 'charts', label: 'Cifras', description: 'Letras e acordes', icon: FileText }, { value: 'scores', label: 'Partituras', description: 'Notas e instrumentos', icon: Music4 }] as const).map(({ value, label, description, icon: Icon }) => <button key={value} type="button" role="tab" aria-label={label} aria-selected={tab === value} aria-controls={value === 'scores' ? 'library-scores' : 'library-items'} onClick={() => { setFolder(null); const next = new URLSearchParams(params); if (value === 'studio') next.delete('aba'); else next.set('aba', value === 'charts' ? 'cifras' : 'partituras'); setParams(next, { replace: true }); }} className={`library-tab ${tab === value ? 'is-current' : ''}`}><span className="flex w-full items-center justify-between gap-1"><Icon className="size-5" aria-hidden /><span className="text-xs tabular-nums opacity-70" aria-hidden>{counts[value]}</span></span><span className="mt-3 block text-sm font-semibold">{label}</span><span className="mt-1 hidden text-xs text-muted-foreground sm:block">{description}</span></button>)}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{tab === 'studio' ? 'Áudios originais para explorar faixas, letras e harmonia.' : tab === 'charts' ? 'Suas cifras salvas, com os tons e as formações que você escolheu.' : 'Partituras prontas para abrir, tocar e imprimir, sem reprocessar o áudio.'}</p>

      {songs && songs.length > 0 && (
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

      {tab !== 'scores' && folders.length > 1 && (
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

      {tab !== 'scores' && songs && songs.length === 0 && (
        <div className="mt-16 max-w-md">
          <Music className="size-10 text-primary" />
          <p className="mt-4 text-xl font-semibold">Sua biblioteca está vazia.</p>
          <p className="mt-2 text-muted-foreground">
            Adicione um MP3 e o will-music encontra o tom, os acordes e a letra para montar a cifra.
          </p>
          <Link to="/nova" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:brightness-105">
            <Plus className="size-4" /> Adicionar a primeira música
          </Link>
        </div>
      )}

      {tab === 'scores' && <div id="library-scores"><Scores embedded query={query} revision={scoresRevision} onDeleted={() => void refresh().catch(e => setNotice(String(e)))} /></div>}
      {tab !== 'scores' && <ul id="library-items" className="library-grid mt-5">
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
      {tab !== 'scores' && songs && songs.length > 0 && visible.length === 0 && <p className="mt-6 text-muted-foreground">{query ? `Nenhuma música encontrada para “${query}”.` : tab === 'studio' ? 'Nenhum áudio nesta aba. Importe um MP3 para abrir o Estúdio.' : 'Nenhuma cifra independente. Salve uma cifra pelo Estúdio ou crie uma sem áudio.'}</p>}

      <AboutButton autoOpenOnce />
    </section>
  );
};
