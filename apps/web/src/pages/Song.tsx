import { ArrowLeft, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnalysisProgress } from '../components/AnalysisProgress.tsx';
import { ChartView } from '../components/ChartView.tsx';
import { Player, activeIndexAt } from '../components/Player.tsx';
import { type Analysis, type Chart, type Song as SongRecord, db, deleteSong } from '../lib/db.ts';
import { type PipelineProgress, runPipeline } from '../lib/pipeline.ts';
import { prefersFlats, transposeKey } from '../lib/transpose.ts';
import { Button, IconButton } from '../ui/Button.tsx';

const running = new Set<string>();

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
  const lineStarts = useRef<number[]>([]);

  const load = useCallback(async () => {
    const [s, c, a] = await Promise.all([
      db.songs.get(id),
      db.charts.where('songId').equals(id).first(),
      db.analyses.where('songId').equals(id).first(),
    ]);
    setSong(s ?? null);
    setChart(c);
    setAnalysis(a);
    lineStarts.current = a?.lyrics?.lines.map((l) => l.start) ?? [];
    return s;
  }, [id]);

  const analyze = useCallback(async () => {
    if (running.has(id)) return;
    running.add(id);
    setProgress({ label: 'Preparando o áudio' });
    try {
      await runPipeline(id, setProgress);
    } catch {
      // status and message are stored on the song
    } finally {
      running.delete(id);
      setProgress(null);
      await load();
    }
  }, [id, load]);

  useEffect(() => {
    let url: string | undefined;
    void (async () => {
      const s = await load();
      const audio = await db.audio.get(id);
      if (audio) {
        url = URL.createObjectURL(audio.blob);
        setAudioUrl(url);
      }
      if (s && (s.analysisStatus === 'pending' || (s.analysisStatus === 'running' && !running.has(id)))) void analyze();
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, load, analyze]);

  const onTime = useCallback((t: number) => setActiveLine(activeIndexAt(lineStarts.current, t)), []);

  const saveChart = async (patch: Partial<Chart>) => {
    if (!chart) return;
    setChart({ ...chart, ...patch });
    await db.charts.update(chart.id, { ...patch, updatedAt: new Date().toISOString() });
  };

  const shownKey = useMemo(() => (song?.key ? transposeKey(song.key, chart?.transpose ?? 0) : undefined), [song?.key, chart?.transpose]);

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
            <span className="block text-sm text-muted-foreground">Tom</span>
            <span className="text-4xl font-bold text-chord">{shownKey}</span>
          </div>
        )}
      </div>

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
        <p className="mt-4 text-sm text-muted-foreground">Não encontramos a letra desta música. A cifra mostra só os acordes.</p>
      )}

      {chart && !progress && (
        <div className="mt-6">
          <ChartView
            chordPro={chart.chordPro}
            transpose={chart.transpose}
            preferFlats={shownKey ? prefersFlats(shownKey) : false}
            fontSize={chart.fontSize}
            activeLineIndex={activeLine}
            autoScroll={autoScroll}
          />
        </div>
      )}

      {audioUrl && <Player src={audioUrl} onTime={onTime} autoScroll={autoScroll} onAutoScrollChange={setAutoScroll} />}
    </section>
  );
};
