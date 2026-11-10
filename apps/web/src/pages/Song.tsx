import { ArrowLeft, Info, Minus, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChartOptions } from '../components/ChartOptions.tsx';
import { AnalysisProgress, LyricsSkeleton, TranscribingBar, formatElapsed } from '../components/AnalysisProgress.tsx';
import { ChartView } from '../components/ChartView.tsx';
import { LyricsPanel } from '../components/LyricsPanel.tsx';
import { chartLineStarts, lyricTexts } from '../lib/lineTimes.ts';
import { syncKeyAction, useSyncMode } from '../lib/useSyncMode.ts';
import { applyLyrics } from '../lib/lyricsApply.ts';
import { Player, type PlayerControls, activeIndexAt } from '../components/Player.tsx';
import { SongInfoForm } from '../components/SongInfoForm.tsx';
import { setChordProMeta } from '../lib/chordProEdit.ts';
import { type Analysis, type Chart, type Song as SongRecord, db, updateSong } from '../lib/db.ts';
import { isRunning, startAnalysis, subscribeAnalysis } from '../lib/jobs.ts';
import { type PipelineProgress, runPipeline } from '../lib/pipeline.ts';
import { prefersFlats, transposeChord, transposeKey } from '../lib/transpose.ts';
import { toDisplayLabel } from '@will-music/engine';
import { ExportButton } from '../components/PackageButtons.tsx';
import { ChordDiagram } from '../components/ChordDiagram.tsx';
import { ChordHelp } from '../components/ChordHelp.tsx';
import { useScrollPrefs, useSteadyScroll } from '../lib/steadyScroll.ts';
import { TranscribeLyrics } from '../components/TranscribeLyrics.tsx';
import { useStems } from '../lib/useStems.ts';
import { readInstrument } from '../components/ChordPanel.tsx';
import { ChartChordShapes } from '../components/ChartChordShapes.tsx';
import { Button, IconButton } from '../ui/Button.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';
import { getPendingAnalysis, retainSessionAnalysis } from '../lib/pendingAnalysis.ts';
import { savePendingAnalysis } from '../lib/saveAnalysis.ts';
import { diagnoseAudioImport } from '../lib/importDiagnostics.ts';
import { Studio } from '../components/Studio.tsx';
import { ChordVariations } from '../components/ChordVariations.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { remapLineTimes } from '../lib/lineTimes.ts';

export const Song = () => {
  const { id = '' } = useParams();
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
  const stems = useStems(id, audioUrl, true);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [activeLine, setActiveLine] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scroll, setScroll] = useScrollPrefs();
  const [isPlaying, setIsPlaying] = useState(false);
  const [help, setHelp] = useState<{ chord: string; anchor: DOMRect } | null>(null);
  const closeHelp = useCallback(() => setHelp(null), []);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showCurrent, setShowCurrent] = useState(true);
  const [studioOptions, setStudioOptions] = useState(false);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [studioChord, setStudioChord] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const lineStarts = useRef<number[]>([]);
  const player = useRef<PlayerControls | null>(null);
  const chartContent = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [s, c, a] = await Promise.all([
      db.songs.get(id),
      db.charts.where('songId').equals(id).first(),
      db.analyses.where('songId').equals(id).first(),
    ]);
    const pending = getPendingAnalysis(id);
    const shownChart = pending?.chart ?? c;
    const shownAnalysis = pending?.analysis ?? a;
    setUnsaved(!!pending && !pending.sessionOnly);
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
        if (event.tempo !== undefined) setSong(current => current && current.tempo !== event.tempo ? { ...current, tempo: event.tempo } : current);
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
    startAnalysis(id, (onProgress) => runPipeline(id, onProgress, { persist: false })).catch((error: unknown) => {
      setRuntimeError(error instanceof Error ? error.message : 'A análise falhou.');
    });
    return follow();
  }, [id, follow]);

  useEffect(() => {
    let cancelled = false;
    const releaseAnalysis = retainSessionAnalysis(id);
    setAudioUrl(undefined);
    setCurrentIndex(-1);
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
      else if (s && audio && !getPendingAnalysis(id)) unsubscribe = analyze();
    })();
    return () => {
      cancelled = true;
      unsubscribe();
      releaseAnalysis();
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
    setCurrentIndex(i);
    setCurrentRaw(i >= 0 ? chordStarts.current.raws[i]! : null);
  }, []);

  const saveChart = async (patch: Partial<Chart>) => {
    if (!chart) return;
    const pending = getPendingAnalysis(id);
    if (pending) { pending.chart = { ...pending.chart, ...patch, updatedAt: new Date().toISOString() }; setChart({ ...chart, ...patch }); return; }
    await db.charts.update(chart.id, { ...patch, updatedAt: new Date().toISOString() });
    setChart({ ...chart, ...patch });
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

  if (audioUrl) return <>
    <Studio key={id} song={song} chart={chart} analysis={analysis} progress={progress} stems={stems}
      onScoreBusyChange={setScoreBusy}
      tools={<Button variant="ghost" onClick={() => setStudioOptions(true)}><Info className="size-4" /> Dados da música</Button>}
      activeLine={activeLine} currentIndex={currentIndex} shownKey={shownKey} playing={isPlaying} autoScroll={autoScroll && scroll.mode === 'follow'}
      onSeek={time => player.current?.playFrom(time)} getTime={() => player.current?.currentTime() ?? 0} onChord={setStudioChord}
      onRetry={() => { if (!scoreBusy) void analyze(); }} error={runtimeError ?? (song.analysisStatus === 'error' ? song.analysisError : null)}
      onEdit={async chordPro => {
        if (!chart) return;
        await saveChart({ chordPro, origin: 'edited', lineTimes: remapLineTimes(chart.chordPro, chordPro, chart.lineTimes ?? lineStarts.current) });
        await load();
      }}
      recovery={unsaved && !progress ? <details className="mt-4 rounded-xl border border-border p-3 text-sm"><summary>Salvar ou exportar resultado</summary><p className="mt-2 text-muted-foreground">Este resultado está nesta sessão. Salve ou exporte antes de fechar o app.</p><div className="mt-3 flex flex-wrap gap-2"><Button disabled={savingResult} onClick={() => { setSavingResult(true); void savePendingAnalysis(id).then(load).catch((e: unknown) => setResultSaveError(String(e))).finally(() => setSavingResult(false)); }}>Tentar salvar sem reanalisar</Button><ExportButton songIds={[id]} title={song.title} label="Exportar resultado" /></div>{resultSaveError && <p role="alert" className="mt-2 text-danger">{resultSaveError}</p>}</details> : null}
      player={<Player key={id} sources={stems.sources} songId={id} title={song.title} onTime={onTime} controls={player}
        deferWaveform={!!progress}
        studio={{ artist: song.artist, tempo: song.tempo, keyLabel: shownKey }}
        extra={<section className="space-y-5 border-t border-border px-4 py-4">
          <h2 className="text-sm font-semibold">Tom e apresentação da cifra</h2>
          <p className="text-sm text-muted-foreground">A transposição altera a cifra e os diagramas. O áudio mantém o tom original.</p>
          <div className="flex items-center gap-3"><span className="mr-auto">Tom: {shownKey || 'Não identificado'}</span><IconButton label="Meio tom abaixo" disabled={!chart} onClick={() => { if (chart) void saveChart({ transpose: chart.transpose - 1 }); }}><Minus className="size-4" /></IconButton><span>{chart?.transpose ?? 0}</span><IconButton label="Meio tom acima" disabled={!chart} onClick={() => { if (chart) void saveChart({ transpose: chart.transpose + 1 }); }}><Plus className="size-4" /></IconButton></div>
          {chart && <label className="flex items-center gap-3">Tamanho da letra <input aria-label="Tamanho da letra" type="range" min={12} max={40} value={chart.fontSize} onChange={e => void saveChart({ fontSize: Number(e.target.value) })} className="min-w-0 flex-1 accent-[var(--primary)]" /></label>}
        </section>}
        autoScroll={autoScroll} onAutoScrollChange={setAutoScroll} scrollMode={scroll.mode} onScrollModeChange={mode => setScroll({ mode })} scrollSpeed={scroll.speed} onScrollSpeedChange={speed => setScroll({ speed })} onTransport={t => setIsPlaying(t.playing)} />}
    />
    {studioOptions && <BottomSheet title="Dados da música" onClose={() => setStudioOptions(false)}>{() => <div className="space-y-4 overflow-auto px-4 pb-5">
      <Button variant="outline" disabled={!!progress || !!stems.progress || unsaved || scoreBusy} onClick={() => { setStudioOptions(false); void analyze(); }}><RefreshCw className="size-4" /> Analisar de novo</Button>
      {!progress && <SongInfoForm basic song={song} onSave={info => void (async () => { try { await updateSong(id, info); const pending = getPendingAnalysis(id); if (pending) pending.song = { ...pending.song, ...info }; if (chart) await saveChart({ chordPro: setChordProMeta(chart.chordPro, { title: info.title, artist: info.artist }) }); await load(); setStudioOptions(false); } catch (e) { setResultSaveError(String(e)); } })()} />}
      {resultSaveError && <p className="text-sm text-danger" role="alert">{resultSaveError}</p>}
    </div>}</BottomSheet>}
    {studioChord && <BottomSheet title={`Como tocar ${studioChord}`} onClose={() => setStudioChord(null)}>{() => <ChordVariations key={studioChord} chord={studioChord} />}</BottomSheet>}
  </>;

  return (
    <section>
      <Link to="/?aba=cifras" className="-ml-1 inline-flex items-center gap-1 text-sm font-semibold text-chord hover:text-primary">
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

      {chart && <ChartOptions key={chart.id} chart={chart} song={song} shownKey={shownKey} content={chartContent} disabled={unsaved}
        onPatch={saveChart}
        onEdit={async chordPro => { await saveChart({ chordPro, origin: 'edited', lineTimes: remapLineTimes(chart.chordPro, chordPro, chart.lineTimes ?? lineStarts.current) }); await load(); }}
      />}

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
        <div ref={chartContent} className={`mt-6 ${syncing ? 'cursor-pointer select-none' : ''}`} onClick={syncing ? syncMode.mark : undefined}>
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
          <ChartChordShapes chart={chart} spellKey={shownKey} onChange={(chordShapes, chordInstrument) => void saveChart({ chordShapes, chordInstrument })} />
        </div>
      )}

      {help && <ChordHelp strict chord={help.chord} anchor={help.anchor} onClose={closeHelp} />}


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
