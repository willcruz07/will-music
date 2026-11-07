import { ArrowLeft, FileText, Info, Minus, Pencil, Plus, RefreshCw, Timer, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnalysisProgress } from '../components/AnalysisProgress.tsx';
import { ChartView } from '../components/ChartView.tsx';
import { LyricsPanel } from '../components/LyricsPanel.tsx';
import { chartLineStarts, lyricTexts } from '../lib/lineTimes.ts';
import { createSyncSession } from '../lib/syncSession.ts';
import { applyLyrics } from '../lib/lyricsApply.ts';
import { Player, type PlayerControls, activeIndexAt } from '../components/Player.tsx';
import { SongInfoForm } from '../components/SongInfoForm.tsx';
import { setChordProMeta } from '../lib/chordProEdit.ts';
import { type Analysis, type Chart, type Song as SongRecord, db, deleteSong, updateSong } from '../lib/db.ts';
import { isRunning, startAnalysis, subscribeAnalysis } from '../lib/jobs.ts';
import { type PipelineProgress, runPipeline } from '../lib/pipeline.ts';
import { prefersFlats, transposeChord, transposeKey } from '../lib/transpose.ts';
import { toDisplayLabel } from '@will-music/engine';
import { ChordDiagram } from '../components/ChordDiagram.tsx';
import { ChordPanel, readInstrument } from '../components/ChordPanel.tsx';
import { Button, IconButton } from '../ui/Button.tsx';

export const Song = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongRecord | null | undefined>(undefined);
  const [chart, setChart] = useState<Chart | undefined>();
  const [analysis, setAnalysis] = useState<Analysis | undefined>();
  const [audioUrl, setAudioUrl] = useState<string>();
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [activeLine, setActiveLine] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showLyrics, setShowLyrics] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [showCurrent, setShowCurrent] = useState(true);
  const lineStarts = useRef<number[]>([]);
  const player = useRef<PlayerControls | null>(null);
  const sync = useRef<ReturnType<typeof createSyncSession> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [, setSyncTick] = useState(0);

  const load = useCallback(async () => {
    const [s, c, a] = await Promise.all([
      db.songs.get(id),
      db.charts.where('songId').equals(id).first(),
      db.analyses.where('songId').equals(id).first(),
    ]);
    setSong(s ?? null);
    setChart(c);
    setAnalysis(a);
    lineStarts.current = chartLineStarts(c, a?.lyrics?.lines);
    return s;
  }, [id]);

  // Follows the analysis through the module-level job registry, so leaving and reopening the page keeps showing it.
  const follow = useCallback(
    () =>
      subscribeAnalysis(id, (event) => {
        if (event === 'done') {
          setProgress(null);
          void load();
        } else setProgress(event);
      }),
    [id, load],
  );

  const analyze = useCallback(() => {
    setProgress({ label: 'Preparando o áudio' });
    startAnalysis(id, (onProgress) => runPipeline(id, onProgress)).catch(() => {
      // status and message are stored on the song
    });
    return follow();
  }, [id, follow]);

  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    let unsubscribe = () => {};
    void (async () => {
      const s = await load();
      const audio = await db.audio.get(id);
      if (cancelled) return;
      if (audio) {
        url = URL.createObjectURL(audio.blob);
        setAudioUrl(url);
      }
      if (isRunning(id)) unsubscribe = follow();
      else if (s && (s.analysisStatus === 'pending' || s.analysisStatus === 'running')) unsubscribe = analyze();
    })();
    return () => {
      cancelled = true;
      unsubscribe();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, load, analyze, follow]);

  const chordStarts = useRef<{ starts: number[]; raws: string[] }>({ starts: [], raws: [] });
  const [currentRaw, setCurrentRaw] = useState<string | null>(null);
  useEffect(() => {
    const usable = (analysis?.chords ?? []).filter((c) => c.raw !== 'N' && c.raw !== 'X');
    chordStarts.current = { starts: usable.map((c) => c.start), raws: usable.map((c) => c.raw) };
  }, [analysis]);

  const onTime = useCallback((t: number) => {
    setActiveLine(activeIndexAt(lineStarts.current, t));
    const i = activeIndexAt(chordStarts.current.starts, t);
    setCurrentRaw(i >= 0 ? chordStarts.current.raws[i]! : null);
  }, []);

  const saveChart = async (patch: Partial<Chart>) => {
    if (!chart) return;
    setChart({ ...chart, ...patch });
    await db.charts.update(chart.id, { ...patch, updatedAt: new Date().toISOString() });
  };

  const shownKey = useMemo(() => (song?.key ? transposeKey(song.key, chart?.transpose ?? 0) : undefined), [song?.key, chart?.transpose]);

  const finishSync = useCallback(async () => {
    const session = sync.current;
    sync.current = null;
    setSyncing(false);
    player.current?.pause();
    if (!session || !chart) return;
    await db.charts.update(chart.id, { lineTimes: session.times, updatedAt: new Date().toISOString() });
    await load();
  }, [chart, load]);

  const startSync = () => {
    if (!chart) return;
    const count = lyricTexts(chart.chordPro).length;
    sync.current = createSyncSession(count, chart.lineTimes ?? lineStarts.current);
    setSyncing(true);
    player.current?.playFrom(0);
  };

  const markLine = useCallback(() => {
    const session = sync.current;
    if (!session) return;
    session.mark(player.current?.currentTime() ?? 0);
    setSyncTick((n) => n + 1);
    if (session.done) void finishSync();
  }, [finishSync]);

  useEffect(() => {
    if (!syncing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        markLine();
      } else if (e.key === 'ArrowLeft') {
        sync.current?.back();
        setSyncTick((n) => n + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [syncing, markLine]);

  // Leaving the page while syncing keeps the marks made so far.
  useEffect(() => () => void (sync.current && finishSync()), [finishSync]);

  if (song === undefined) return null;
  if (song === null) {
    return (
      <section>
        <h1 className="text-2xl font-bold">Música não encontrada</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">
          Voltar para a biblioteca
        </Link>
      </section>
    );
  }

  return (
    <section>
      <Link to="/" className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Biblioteca
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{song.title}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{song.artist || 'Artista desconhecido'}</p>
        </div>
        {shownKey && (
          <div className="text-right">
            <span className="block text-sm text-muted-foreground">
              Tom{song.capo ? ` · Capo ${song.capo}` : ''}
              {song.tempo ? ` · ${song.tempo} BPM` : ''}
            </span>
            <span className="text-4xl font-bold text-chord">{shownKey}</span>
          </div>
        )}
      </div>

      {editingInfo && (
        <SongInfoForm
          song={song}
          onSave={(info) =>
            void (async () => {
              await updateSong(song.id, info);
              if (chart) {
                const chordPro = setChordProMeta(chart.chordPro, { title: info.title, artist: info.artist });
                await db.charts.update(chart.id, { chordPro, updatedAt: new Date().toISOString() });
              }
              setEditingInfo(false);
              await load();
            })()
          }
        />
      )}

      {chart && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-border py-2">
          <span className="text-sm text-muted-foreground">Transpor</span>
          <IconButton label="Meio tom abaixo" onClick={() => void saveChart({ transpose: chart.transpose - 1 })}>
            <Minus className="size-4" />
          </IconButton>
          <span className="w-8 text-center tabular-nums">{chart.transpose > 0 ? `+${chart.transpose}` : chart.transpose}</span>
          <IconButton label="Meio tom acima" onClick={() => void saveChart({ transpose: chart.transpose + 1 })}>
            <Plus className="size-4" />
          </IconButton>
          <span className="ml-4 text-sm text-muted-foreground">Letra</span>
          <IconButton label="Diminuir letra" onClick={() => void saveChart({ fontSize: Math.max(12, chart.fontSize - 2) })}>
            <span className="text-sm font-bold">A−</span>
          </IconButton>
          <IconButton label="Aumentar letra" onClick={() => void saveChart({ fontSize: Math.min(40, chart.fontSize + 2) })}>
            <span className="text-lg font-bold">A+</span>
          </IconButton>
          <span className="flex-1" />
          {audioUrl && lyricTexts(chart.chordPro).length > 0 && !syncing && (
            <Button variant="ghost" onClick={startSync}>
              <Timer className="size-4" /> Sincronizar
            </Button>
          )}
          <Link to={`/musica/${song.id}/editar`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted">
            <Pencil className="size-4" /> Editar cifra
          </Link>
          <Button variant="ghost" onClick={() => setEditingInfo((v) => !v)} aria-pressed={editingInfo}>
            <Info className="size-4" /> Dados
          </Button>
          {analysis?.lyrics && (
            <Button variant="ghost" onClick={() => setShowLyrics((v) => !v)} aria-pressed={showLyrics}>
              <FileText className="size-4" /> Trocar letra
            </Button>
          )}
          <IconButton label="Analisar de novo" onClick={() => void analyze()} disabled={!!progress}>
            <RefreshCw className="size-4" />
          </IconButton>
          <IconButton
            label="Excluir música"
            onClick={() => {
              if (confirm(`Excluir “${song.title}” da biblioteca?`)) void deleteSong(song.id).then(() => navigate('/'));
            }}
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      )}

      {progress && <AnalysisProgress progress={progress} />}

      {!progress && song.analysisStatus === 'error' && (
        <div className="mt-8 max-w-lg rounded-lg border border-danger/40 p-4">
          <p className="font-semibold text-danger">A análise não terminou.</p>
          <p className="mt-1 text-sm text-muted-foreground">{song.analysisError}</p>
          <Button className="mt-4" onClick={() => void analyze()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!progress && analysis?.lyrics?.warning && <p className="mt-4 text-sm text-muted-foreground">{analysis.lyrics.warning}</p>}
      {!progress && analysis && !analysis.lyrics && (
        <p className="mt-4 text-sm text-muted-foreground">Não encontramos a letra desta música. A cifra mostra só os acordes; busque ou cole a letra abaixo.</p>
      )}
      {!progress && analysis && (showLyrics || !analysis.lyrics) && (
        <LyricsPanel
          title={song.title}
          artist={song.artist}
          durationSec={song.durationSec}
          onApply={(lyrics) =>
            void applyLyrics(song.id, lyrics).then(async () => {
              setShowLyrics(false);
              await load();
            })
          }
        />
      )}

      {syncing && sync.current && (
        <div className="sticky top-14 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary bg-surface p-3" role="status">
          <p className="mr-auto text-sm">
            <span className="font-semibold">Sincronizando.</span> Toque na letra ou aperte espaço quando cada linha começar. Seta para a esquerda desfaz a última marca.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              sync.current?.back();
              setSyncTick((n) => n + 1);
            }}
          >
            Voltar uma linha
          </Button>
          <Button onClick={() => void finishSync()}>Concluir</Button>
        </div>
      )}

      {chart && !progress && (
        <div className={`mt-6 ${syncing ? 'cursor-pointer select-none' : ''}`} onClick={syncing ? markLine : undefined}>
          <ChartView
            chordPro={chart.chordPro}
            transpose={chart.transpose}
            preferFlats={shownKey ? prefersFlats(shownKey) : false}
            spellKey={shownKey}
            fontSize={chart.fontSize}
            activeLineIndex={syncing && sync.current ? sync.current.next : activeLine}
            autoScroll={autoScroll || syncing}
          />
        </div>
      )}

      {chart && !progress && <ChordPanel chordPro={chart.chordPro} transpose={chart.transpose} spellKey={shownKey} />}

      {audioUrl && currentRaw && showCurrent && (
        <div className="fixed bottom-24 right-4 z-30 rounded-lg border border-border bg-surface p-3 shadow-sm">
          <button type="button" onClick={() => setShowCurrent(false)} className="absolute right-1 top-1 rounded px-1 text-xs text-muted-foreground hover:bg-muted" aria-label="Esconder acorde atual">
            ×
          </button>
          <ChordDiagram chord={transposeChord(toDisplayLabel(currentRaw), chart?.transpose ?? 0, shownKey ?? false)} instrument={readInstrument()} />
        </div>
      )}

      {audioUrl && <Player src={audioUrl} onTime={onTime} autoScroll={autoScroll} onAutoScrollChange={setAutoScroll} controls={player} />}
    </section>
  );
};
