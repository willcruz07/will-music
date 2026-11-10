import { ArrowLeft, FileText, Info, Minus, MonitorPlay, Music4, Pencil, Plus, RefreshCw, Timer, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ScrollStrip } from '../components/ScrollStrip.tsx';
import { AnalysisProgress, LyricsSkeleton, TranscribingBar, formatElapsed } from '../components/AnalysisProgress.tsx';
import { ChartView } from '../components/ChartView.tsx';
import { LyricsPanel } from '../components/LyricsPanel.tsx';
import { chartLineStarts, lyricTexts } from '../lib/lineTimes.ts';
import { syncKeyAction, useSyncMode } from '../lib/useSyncMode.ts';
import { applyLyrics } from '../lib/lyricsApply.ts';
import { Player, type PlayerControls, activeIndexAt } from '../components/Player.tsx';
import { SongInfoForm } from '../components/SongInfoForm.tsx';
import { setChordProMeta } from '../lib/chordProEdit.ts';
import { type Analysis, type Chart, type Song as SongRecord, db, deleteSong, updateSong } from '../lib/db.ts';
import { isRunning, startAnalysis, subscribeAnalysis } from '../lib/jobs.ts';
import { type PipelineProgress, runPipeline } from '../lib/pipeline.ts';
import { prefersFlats, transposeChord, transposeKey } from '../lib/transpose.ts';
import { toDisplayLabel } from '@will-music/engine';
import { AddToSetlist } from '../components/AddToSetlist.tsx';
import { ExportButton } from '../components/PackageButtons.tsx';
import { ChordDiagram } from '../components/ChordDiagram.tsx';
import { ChordHelp } from '../components/ChordHelp.tsx';
import { useScrollPrefs, useSteadyScroll } from '../lib/steadyScroll.ts';
import { TranscribeLyrics } from '../components/TranscribeLyrics.tsx';
import { useStems } from '../lib/useStems.ts';
import { ChordPanel, readInstrument } from '../components/ChordPanel.tsx';
import { Button, IconButton } from '../ui/Button.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';
import { getPendingAnalysis } from '../lib/pendingAnalysis.ts';
import { savePendingAnalysis } from '../lib/saveAnalysis.ts';
import { diagnoseAudioImport } from '../lib/importDiagnostics.ts';

export const Song = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongRecord | null | undefined>(undefined);
  const [chart, setChart] = useState<Chart | undefined>();
  const [analysis, setAnalysis] = useState<Analysis | undefined>();
  const [unsaved, setUnsaved] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [resultSaveError, setResultSaveError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [diagnosingResult, setDiagnosingResult] = useState(false);
  const [resultDiagnostic, setResultDiagnostic] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>();
  const stems = useStems(id, audioUrl);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [activeLine, setActiveLine] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [scroll, setScroll] = useScrollPrefs();
  const [isPlaying, setIsPlaying] = useState(false);
  const [help, setHelp] = useState<{ chord: string; anchor: DOMRect } | null>(null);
  const closeHelp = useCallback(() => setHelp(null), []);
  const [showLyrics, setShowLyrics] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [showCurrent, setShowCurrent] = useState(true);
  const lineStarts = useRef<number[]>([]);
  const player = useRef<PlayerControls | null>(null);

  const load = useCallback(async () => {
    const [s, c, a] = await Promise.all([
      db.songs.get(id),
      db.charts.where('songId').equals(id).first(),
      db.analyses.where('songId').equals(id).first(),
    ]);
    const pending = getPendingAnalysis(id);
    const shownChart = pending?.chart ?? c;
    const shownAnalysis = pending?.analysis ?? a;
    setUnsaved(!!pending);
    setSong(pending?.song ?? s ?? null);
    setChart(shownChart);
    setAnalysis(shownAnalysis);
    lineStarts.current = chartLineStarts(shownChart, shownAnalysis?.lyrics?.lines);
    return pending?.song ?? s;
  }, [id]);

  // Follows the analysis through the module-level job registry, so leaving and reopening the page keeps showing it.
  // Once only the lyrics are left (the chart with the chords is saved), the chords show while Whisper listens.
  const chartShown = useRef(false);
  const follow = useCallback(
    () =>
      subscribeAnalysis(id, (event) => {
        if (event === 'done') {
          chartShown.current = false;
          setProgress(null);
          void load();
          return;
        }
        if (event.lyricsPending && !chartShown.current) {
          chartShown.current = true;
          void load();
        }
        setProgress(event);
      }),
    [id, load],
  );

  const analyze = useCallback(() => {
    setRuntimeError(null);
    setProgress({ label: 'Preparando o áudio' });
    startAnalysis(id, (onProgress) => runPipeline(id, onProgress)).catch((error: unknown) => {
      setRuntimeError(error instanceof Error ? error.message : 'A análise falhou.');
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
    const pending = getPendingAnalysis(id);
    if (pending) { pending.chart = { ...pending.chart, ...patch, updatedAt: new Date().toISOString() }; return; }
    await db.charts.update(chart.id, { ...patch, updatedAt: new Date().toISOString() });
  };

  const lyricsPending = !!progress?.lyricsPending;
  const showChart = !progress || lyricsPending;

  const shownKey = useMemo(() => (song?.key ? transposeKey(song.key, chart?.transpose ?? 0) : undefined), [song?.key, chart?.transpose]);

  // Saved through a ref inside useSyncMode: re-renders (font size, transpose, reloads) never end the session.
  const syncMode = useSyncMode({
    currentTime: () => player.current?.currentTime() ?? 0,
    onSave: (times) => {
      player.current?.pause();
      const chartId = chart?.id;
      if (!chartId) return;
      void saveChart({ lineTimes: times }).then(() => load());
    },
  });
  const syncing = syncMode.syncing;
  useSteadyScroll(autoScroll && scroll.mode === 'steady' && isPlaying && !syncing, scroll.speed);

  const startSync = () => {
    if (!chart) return;
    syncMode.start(lyricTexts(chart.chordPro).length, chart.lineTimes ?? lineStarts.current);
    player.current?.playFrom(0);
  };

  useEffect(() => {
    if (!syncing) return;
    const onKey = (e: KeyboardEvent) => {
      const action = syncKeyAction({ code: e.code, key: e.key, targetTag: (e.target as HTMLElement | null)?.tagName });
      if (!action) return;
      e.preventDefault();
      if (action === 'mark') syncMode.mark();
      else syncMode.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [syncing, syncMode.mark, syncMode.back]);

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
      <Link to="/" className="-ml-1 inline-flex items-center gap-1 text-sm font-semibold text-chord hover:text-primary">
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
        <ScrollStrip
          role="toolbar"
          label="Ferramentas da música"
          className="mt-5 border-y border-border py-1.5 md:mx-0"
          stripClassName="md:overflow-visible md:px-0"
          innerClassName="items-center gap-2 md:w-auto md:flex-wrap"
        >
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
          {!unsaved && <><Link to={`/musica/${song.id}/editar`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted">
            <Pencil className="size-4" /> Editar letra e acordes
          </Link>
          <Link to={`/palco/musica/${song.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted">
            <MonitorPlay className="size-4" /> Palco
          </Link>
          <Link to={`/musica/${song.id}/partitura`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted">
            <Music4 className="size-4" /> Partitura
          </Link>
          <AddToSetlist songId={song.id} /></>}
          <ExportButton songIds={[song.id]} title={song.title} />
          {!unsaved && <Button variant="ghost" onClick={() => setEditingInfo((v) => !v)} aria-pressed={editingInfo}>
            <Info className="size-4" /> Dados
          </Button>}
          {!unsaved && analysis?.lyrics && (
            <Button variant="ghost" onClick={() => setShowLyrics((v) => !v)} aria-pressed={showLyrics}>
              <FileText className="size-4" /> Trocar letra
            </Button>
          )}
          {audioUrl && (
            <IconButton label="Analisar de novo" onClick={() => void analyze()} disabled={unsaved || !!progress || !!stems.progress}>
              <RefreshCw className="size-4" />
            </IconButton>
          )}
          <IconButton
            label="Excluir música"
            onClick={() => {
              void confirmDialog({ title: 'Excluir música?', message: `“${song.title}” sai da biblioteca, com o áudio, a cifra e as faixas.`, confirmLabel: 'Excluir' }).then(
                (ok) => {
                  if (ok) void deleteSong(song.id).then(() => navigate('/'));
                },
              );
            }}
          >
            <Trash2 className="size-4" />
          </IconButton>
        </ScrollStrip>
      )}

      {progress && !lyricsPending && <AnalysisProgress progress={progress} />}
      {progress && lyricsPending && <TranscribingBar progress={progress} />}

      {!progress && unsaved && (
        <details className="mt-6 max-w-2xl rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm">Salvar ou exportar resultado</summary>
          <p className="mt-1 text-sm text-muted-foreground">A letra e os acordes estão disponíveis nesta sessão. Recarregar ou fechar o app descarta este resultado. Exporte um pacote para preservá-lo ou tente salvar novamente. A edição completa fica disponível após salvar.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={savingResult || diagnosingResult} onClick={() => {
              setSavingResult(true);
              setResultSaveError(null);
              void savePendingAnalysis(id).then(() => load())
                .catch((error: unknown) => setResultSaveError(error instanceof Error ? error.message : 'O navegador recusou a gravação novamente.'))
                .finally(() => setSavingResult(false));
            }}>{savingResult ? 'Salvando…' : 'Tentar salvar sem reanalisar'}</Button>
            <ExportButton songIds={[id]} title={song.title} label="Exportar resultado" />
            <Button variant="outline" disabled={savingResult || diagnosingResult} onClick={() => {
              setDiagnosingResult(true);
              void (async () => {
                const audio = await db.audio.get(id);
                setResultDiagnostic(await diagnoseAudioImport(getPendingAnalysis(id)?.error, { size: audio?.blob.size ?? 0, type: audio?.mimeType ?? '' }));
              })().catch((error: unknown) => setResultDiagnostic(String(error)))
                .finally(() => setDiagnosingResult(false));
            }}>{diagnosingResult ? 'Verificando armazenamento…' : 'Diagnosticar armazenamento'}</Button>
          </div>
          {resultSaveError && <p className="mt-2 text-sm text-danger" role="alert">{resultSaveError}</p>}
          {resultDiagnostic && <textarea readOnly aria-label="Diagnóstico de armazenamento" value={resultDiagnostic} rows={8} className="mt-3 w-full rounded-lg border border-border bg-surface p-2 font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />}
        </details>
      )}

      {!progress && !unsaved && (runtimeError || song.analysisStatus === 'error') && (
        <div className="mt-8 max-w-lg rounded-lg border border-danger/40 p-4">
          <p className="font-semibold text-danger">A análise não terminou.</p>
          <p className="mt-1 text-sm text-muted-foreground">{runtimeError ?? song.analysisError}</p>
          <Button className="mt-4" onClick={() => void analyze()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!progress && analysis?.processing && <p className="mt-3 text-xs text-muted-foreground">
        Processamento {analysis.processing.execution === 'parallel' ? 'paralelo' : 'sequencial'} · Acordes: {formatElapsed(analysis.processing.chordsMs)} · Letra: {formatElapsed(analysis.processing.lyricsMs)} · Total: {formatElapsed(analysis.processing.totalMs)}.
        {analysis.processing.transcriptionRetried && ' A transcrição precisou ser repetida sem concorrência.'}
      </p>}
      {!progress && analysis?.warnings?.map((warning, index) => <p key={index} className="mt-3 text-sm text-muted-foreground">{warning}</p>)}
      {!progress && analysis?.lyrics?.warning && <p className="mt-4 text-sm text-muted-foreground">{analysis.lyrics.warning}</p>}
      {!progress && analysis && !analysis.lyrics && (
        <p className="mt-4 text-sm text-muted-foreground">Não foi possível transcrever a letra desta música. A cifra mostra só os acordes; tente transcrever novamente ou cole a letra abaixo.</p>
      )}
      {!progress && !unsaved && analysis && (showLyrics || !analysis.lyrics) && (
        <>
          <LyricsPanel
            durationSec={song.durationSec}
            onApply={(lyrics) =>
              void applyLyrics(song.id, lyrics).then(async () => {
                setShowLyrics(false);
                await load();
              })
            }
          />
          {audioUrl && (
            <TranscribeLyrics
              songId={song.id}
              hasStems={stems.hasStems}
              onApply={(lyrics) =>
                void applyLyrics(song.id, lyrics).then(async () => {
                  setShowLyrics(false);
                  await load();
                })
              }
            />
          )}
        </>
      )}

      {syncing && (
        <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary bg-surface p-3" role="status">
          <p className="mr-auto text-sm">
            <span className="font-semibold">Sincronizando.</span> Toque na letra ou aperte espaço quando cada linha começar. Seta para a esquerda desfaz a última marca.
          </p>
          <Button
            variant="outline"
            onClick={syncMode.back}
          >
            Voltar uma linha
          </Button>
          <Button onClick={syncMode.finish}>Concluir</Button>
        </div>
      )}

      {chart && lyricsPending && <LyricsSkeleton />}

      {chart && showChart && (
        <div className={`mt-6 ${syncing ? 'cursor-pointer select-none' : ''}`} onClick={syncing ? syncMode.mark : undefined}>
          <ChartView
            chordPro={chart.chordPro}
            transpose={chart.transpose}
            preferFlats={shownKey ? prefersFlats(shownKey) : false}
            spellKey={shownKey}
            fontSize={chart.fontSize}
            activeLineIndex={syncing ? syncMode.next : activeLine}
            autoScroll={(autoScroll && scroll.mode === 'follow') || syncing}
            onChordTap={syncing ? undefined : (chord, anchor) => setHelp({ chord, anchor })}
          />
        </div>
      )}

      {help && <ChordHelp strict chord={help.chord} anchor={help.anchor} onClose={closeHelp} />}

      {chart && showChart && <ChordPanel strict chordPro={chart.chordPro} transpose={chart.transpose} spellKey={shownKey} />}

      {audioUrl && currentRaw && showCurrent && (
        <div className="glass fixed right-4 z-30 rounded-xl border border-border p-3 shadow-sm bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom)+9rem)] lg:bottom-28">
          <button type="button" onClick={() => setShowCurrent(false)} className="absolute right-1 top-1 rounded px-1 text-xs text-muted-foreground hover:bg-muted" aria-label="Esconder acorde atual">
            ×
          </button>
          <ChordDiagram strict chord={transposeChord(toDisplayLabel(currentRaw), chart?.transpose ?? 0, shownKey ?? false)} instrument={readInstrument()} />
        </div>
      )}

      {stems.sources && (
        <Player
          sources={stems.sources}
          onTime={onTime}
          title={song.title}
          songId={song.id}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
          scrollMode={scroll.mode}
          onScrollModeChange={(mode) => setScroll({ mode })}
          scrollSpeed={scroll.speed}
          onScrollSpeedChange={(speed) => setScroll({ speed })}
          stems={progress ? undefined : stems}
          onTransport={(t) => setIsPlaying(t.playing)}
          controls={player}
        />
      )}
      {stems.sources && <div className="h-32 md:h-24" aria-hidden />}
    </section>
  );
};
