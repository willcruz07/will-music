import { Download, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Analysis, Chart, Song, StemsRecord } from '../lib/db.ts';
import { generateStudioScore, saveStudioScores, studioScoreReady, type StudioScore } from '../lib/studioScore.ts';
import { buildScoreXml, downloadText, scoreGrid, SCORE_TYPES, type ScoreProgress, type ScoreType } from '../lib/score.ts';
import { rovingKeys } from '../lib/a11y.ts';
import { Button } from '../ui/Button.tsx';
import { ScrollStrip } from './ScrollStrip.tsx';
import { ProgressBar } from './AnalysisProgress.tsx';
import { ScoreView } from './ScoreView.tsx';
import { chartLineStarts, lyricTexts } from '../lib/lineTimes.ts';
import { ScoreSkeleton } from './StudioSkeletons.tsx';
import { PrintScoreButton } from './PrintScoreButton.tsx';

export const StudioScores = ({ song, analysis, chart, tracks, active, waiting, onBusyChange }: {
  song: Song; analysis?: Analysis; chart?: Chart; tracks?: StemsRecord['tracks']; active: boolean; waiting: boolean; onBusyChange?: (busy: boolean) => void;
}) => {
  const [type, setType] = useState<ScoreType>('melody');
  const [score, setScore] = useState<StudioScore>();
  const [progress, setProgress] = useState<ScoreProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const scoreCache = useRef<StudioScore | undefined>(undefined);
  const scoreTracks = useRef(tracks);
  const epoch = useRef(0);
  const attempted = useRef(new Set<ScoreType>());
  const ready = scoreTracks.current === tracks && studioScoreReady(score, type);
  const documents = useMemo(() => {
    const starts = chartLineStarts(chart, analysis?.lyrics?.lines);
    const lyrics = chart ? lyricTexts(chart.chordPro).map((text, i) => ({ time: starts[i] ?? 0, text })) : analysis?.lyrics?.lines.map(l => ({ time: l.start, text: l.text }));
    return Object.fromEntries(SCORE_TYPES.flatMap(part => {
      if (scoreTracks.current !== tracks || !studioScoreReady(score, part.type)) return [];
      const xml = buildScoreXml(part.type, song, analysis, score, { lyrics });
      return xml ? [[part.type, xml]] : [];
    }));
  }, [song, analysis, chart, score, tracks]);
  const xml = documents[type] ?? null;
  const readyCount = Object.keys(documents).length;
  useEffect(() => { setSavedId(null); }, [documents]);
  const info = SCORE_TYPES.find(t => t.type === type)!;
  useEffect(() => {
    scoreTracks.current = tracks; scoreCache.current = undefined; epoch.current++;
    setScore(undefined); attempted.current.clear(); setError(null); setProgress(null); setSavedId(null); setSaving(false);
    return () => { epoch.current++; controller.current?.abort(); controller.current = null; };
  }, [tracks]);
  useEffect(() => { onBusyChange?.(!!progress); return () => onBusyChange?.(false); }, [!!progress, onBusyChange]);
  useEffect(() => { if (waiting) controller.current?.abort(); }, [waiting]);
  const generate = async () => {
    if (!tracks?.length || controller.current || waiting) return;
    const abort = new AbortController(); controller.current = abort;
    attempted.current.add(type); setError(null); setSavedId(null); setProgress({ stage: 'decode', done: 0, total: 1 });
    try {
      const result = await generateStudioScore(type, song, tracks, scoreCache.current, p => { if (!abort.signal.aborted) setProgress(p); }, abort.signal);
      if (!abort.signal.aborted) { scoreCache.current = result; setScore(result); }
    } catch (e) { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível gerar esta partitura.'); }
    finally { if (controller.current === abort) { controller.current = null; setProgress(null); } }
  };
  useEffect(() => {
    if (active && !waiting && tracks?.length && !ready && !attempted.current.has(type)) void generate();
  }, [active, waiting, tracks, ready, type]);
  return <div>
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1"><ScrollStrip role="tablist" label="Instrumentos da partitura" selected={type} onKeyDown={rovingKeys} innerClassName="gap-2">
        {SCORE_TYPES.map(t => <button key={t.type} type="button" role="tab" aria-selected={type === t.type} aria-controls="studio-score-view" disabled={!!progress || saving} onClick={() => { setType(t.type); setError(null); }} className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm disabled:opacity-50 ${type === t.type ? 'bg-primary/20 text-chord' : 'bg-surface text-muted-foreground'}`}>{t.label}{studioScoreReady(score, t.type) && <span className="ml-2 text-primary" aria-label="Pronta">✓</span>}</button>)}
      </ScrollStrip></div>
      <Button className="shrink-0" disabled={!readyCount || saving || !!progress || !!savedId || waiting} onClick={() => { if (!score) return; const currentEpoch = epoch.current; setSaving(true); setError(null); const grids = Object.fromEntries(SCORE_TYPES.flatMap(part => { const grid = documents[part.type] ? scoreGrid(part.type, analysis, score) : null; return grid ? [[part.type, grid]] : []; })); void saveStudioScores(song, score, documents, grids, type).then(s => { if (epoch.current === currentEpoch) setSavedId(s.id); }).catch(e => { if (epoch.current === currentEpoch) setError(e instanceof Error ? e.message : 'Não foi possível salvar. As partituras continuam nesta sessão.'); }).finally(() => { if (epoch.current === currentEpoch) setSaving(false); }); }}><Save className="size-4" /><span>{saving ? 'Salvando…' : savedId ? 'Partituras salvas' : 'Salvar partituras'}{!saving && !savedId && readyCount > 0 ? ` (${readyCount})` : ''}</span></Button>
    </div>
    <p className="mt-3 text-sm text-muted-foreground">{type === 'choir' ? 'Divisão SATB estimada a partir da voz separada; revise os naipes antes de usar.' : type === 'guitar' ? 'Linha de notas extraída da faixa de guitarra, em pauta e tablatura.' : info.hint}</p>
    {waiting || !tracks?.length ? <div><p className="mt-5 text-muted-foreground" role="status">As partituras ficam disponíveis após a separação. Abra Tracks para acompanhar ou iniciar esse processamento.</p>{waiting && <ScoreSkeleton />}</div> : <>
      {progress && <div className="mt-5" role="status"><p className="text-sm">{progress.stage === 'decode' ? 'Preparando a faixa…' : progress.stage === 'models' ? 'Carregando modelo de notas…' : `Identificando notas… ${progress.done} de ${progress.total}`}</p><ProgressBar fraction={progress.total ? progress.done / progress.total : undefined} /><Button className="mt-2" variant="ghost" onClick={() => { controller.current?.abort(); setError('Geração cancelada. Você pode tentar novamente.'); }}>Cancelar</Button></div>}
      {progress && <ScoreSkeleton />}
      {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
      {!ready && !progress && <Button className="mt-4" onClick={() => void generate()}>Gerar partitura de {info.label.toLowerCase()}</Button>}
      {xml && score && <>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadText(xml, `${song.title} (${info.label}).musicxml`, 'application/vnd.recordare.musicxml+xml')}><Download className="size-4" /> Exportar MusicXML</Button>
          <PrintScoreButton xml={xml} title={`${song.title} — ${info.label}`} />
        </div>
        {savedId && <p className="mt-3 text-sm" role="status">Todas as partes prontas foram salvas sem áudio. <Link to={`/?aba=partituras`} className="text-chord underline">Ver na biblioteca</Link> · <Link to={`/musica/${savedId}/partitura`} className="text-chord underline">Abrir partituras</Link></p>}
        <p className="mt-3 text-xs text-muted-foreground">Rascunho em 4/4, com andamento estimado quando não informado. Confira notas, ritmo e compasso; o MusicXML pode ser revisado no MuseScore.</p>
        {active && <ScoreView xml={xml} />}
      </>}
    </>}
  </div>;
};
