import { ArrowLeft, FileText, Grid2X2, Music4, Pencil, Save, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { enterStudioLayout } from '../lib/studioLayout.ts';
import { Link } from 'react-router';
import { toDisplayLabel } from '@will-music/engine';
import type { Analysis, Chart, Song } from '../lib/db.ts';
import type { PipelineProgress } from '../lib/pipeline.ts';
import type { StemsState } from '../lib/useStems.ts';
import { transposeChord } from '../lib/transpose.ts';
import { saveStudioChart } from '../lib/studioChart.ts';
import { Button } from '../ui/Button.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';
import { ChartView } from './ChartView.tsx';
import { LyricsSkeleton, ProgressBar } from './AnalysisProgress.tsx';
import { ChordVariations } from './ChordVariations.tsx';
import { StemsPanel } from './player/StemsPanel.tsx';
import { StudioMixer } from './StudioMixer.tsx';
import { rovingKeys } from '../lib/a11y.ts';
import { StudioScores } from './StudioScores.tsx';
import { ChordsSkeleton, ChordShapeSkeleton, TracksSkeleton } from './StudioSkeletons.tsx';
import { ChartChordShapes } from './ChartChordShapes.tsx';
import { chartChords, readInstrument } from './ChordPanel.tsx';
import { PrintChartButton } from './PrintChartButton.tsx';

type Props = {
  song: Song; chart?: Chart; analysis?: Analysis; progress: PipelineProgress | null;
  stems: StemsState; player: ReactNode; activeLine: number; currentIndex: number;
  shownKey?: string; autoScroll: boolean; playing?: boolean; recovery: ReactNode; error?: string | null;
  onSeek: (time: number) => void; onChord: (chord: string) => void;
  getTime: () => number;
  onEdit: (chordPro: string) => Promise<void>; onRetry: () => void;
  tools?: ReactNode;
  onScoreBusyChange?: (busy: boolean) => void;
};
const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const TABS = [{ id: 'lyrics', label: 'Letras', icon: FileText }, { id: 'chords', label: 'Acordes', icon: Grid2X2 }, { id: 'tracks', label: 'Tracks', icon: SlidersHorizontal }, { id: 'scores', label: 'Partituras', icon: Music4 }] as const;

export const Studio = (props: Props) => {
  useEffect(enterStudioLayout, []);
  const { song, chart, analysis, progress, stems } = props;
  const [tab, setTab] = useState<'lyrics' | 'chords' | 'tracks' | 'scores'>('lyrics');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const [shapeChoices, setShapeChoices] = useState<NonNullable<Chart['chordShapes']>>(chart?.chordShapes ?? {});
  const [galleryInstrument, setGalleryInstrument] = useState(() => chart?.chordInstrument ?? Object.values(chart?.chordShapes ?? {})[0]?.instrument ?? readInstrument());
  const printable = useRef<HTMLDivElement>(null);
  useEffect(() => { setShapeChoices(chart?.chordShapes ?? {}); setGalleryInstrument(chart?.chordInstrument ?? Object.values(chart?.chordShapes ?? {})[0]?.instrument ?? readInstrument()); }, [chart?.id]);
  const chosenShapes = (text = chart?.chordPro ?? '') => Object.fromEntries(chartChords(text, 0).map(chord => [chord, { instrument: galleryInstrument, variant: shapeChoices[chord]?.instrument === galleryInstrument ? shapeChoices[chord]!.variant : 0 }]));
  const sentinel = useRef<HTMLDivElement>(null);
  const [compactPlayer, setCompactPlayer] = useState(false);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setCompactPlayer(entry.boundingClientRect.top < 0);
    }, { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const chords = useMemo(() => (analysis?.chords ?? []).filter(c => c.raw !== 'N' && c.raw !== 'X'), [analysis]);
  const name = (raw: string) => transposeChord(toDisplayLabel(raw), chart?.transpose ?? 0, props.shownKey ?? false);
  const current = chords[props.currentIndex];
  const lyricsTask = progress?.tasks?.find(t => t.id === 'lyrics');
  const chordTask = progress?.tasks?.find(t => t.id === 'chords');
  const lyricsLoading = !!progress && lyricsTask?.status !== 'done' && lyricsTask?.status !== 'skipped' && lyricsTask?.status !== 'error';
  const chordsLoading = !!progress && chordTask?.status !== 'done';
  const startEdit = () => { setDraft(chart?.chordPro ?? ''); setSavedDraft(chart?.chordPro ?? ''); setEditError(null); setEditing(true); };
  const closeEditor = () => {
    if (busy) return;
    if (draft === savedDraft) { setEditing(false); return; }
    void confirmDialog({ title: 'Descartar alterações?', message: 'O texto que você editou ainda não foi aplicado.', confirmLabel: 'Descartar', cancelLabel: 'Continuar editando' }).then(ok => { if (ok) setEditing(false); });
  };
  const save = async (independent: boolean) => {
    if (!chart || busy) return;
    setBusy(true); setEditError(null);
    try {
      if (independent) {
        const saved = await saveStudioChart(song, { ...chart, chordPro: draft, chordShapes: chosenShapes(draft), chordInstrument: galleryInstrument });
        setNotice(<span>Cifra salva na biblioteca. <Link className="text-chord underline" to={`/musica/${saved.id}`}>Abrir cifra</Link></span>);
      } else { await props.onEdit(draft); setNotice('Letra e cifra atualizadas.'); }
      setEditing(false);
    } catch (error) { setEditError(error instanceof Error ? error.message : 'Não foi possível salvar. Seu texto foi mantido.'); }
    finally { setBusy(false); }
  };
  const saveCurrent = async () => {
    if (!chart || busy) return;
    setBusy(true);
    try { const saved = await saveStudioChart(song, { ...chart, chordShapes: chosenShapes(), chordInstrument: galleryInstrument }); setNotice(<span>Cifra e formações salvas. <Link className="text-chord underline" to={`/musica/${saved.id}`}>Abrir cifra</Link></span>); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível salvar a cifra.'); }
    finally { setBusy(false); }
  };
  return <section className="studio-shell">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <Link to="/" className="-ml-1 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord hover:text-primary"><ArrowLeft className="size-4" /> Biblioteca</Link>
      <div className="flex flex-wrap gap-2">{props.tools}</div>
    </header>
    <div ref={sentinel} className="h-px" aria-hidden />
    <div className="studio-player-sticky" data-compact={compactPlayer}>
      {props.player}
      {tab === 'chords' && <div className="studio-chord-dock" aria-label="Demonstração do acorde">
        {chordsLoading ? <ChordShapeSkeleton /> : current ? <>
          <div className="mb-3 flex items-center justify-around gap-4 text-muted-foreground"><span>{chords[props.currentIndex - 1] ? name(chords[props.currentIndex - 1]!.raw) : '—'}</span><strong className="text-2xl text-chord">{name(current.raw)}</strong><span>{chords[props.currentIndex + 1] ? name(chords[props.currentIndex + 1]!.raw) : '—'}</span></div>
          <ChordVariations chord={name(current.raw)} compact />
        </> : <p className="py-5 text-center text-sm text-muted-foreground">Selecione um acorde para ver sua formação.</p>}
      </div>}
    </div>
    {props.recovery}
    {notice && <p className="mt-4 text-sm" role="status">{notice}</p>}
    {props.error && <div className="mt-4 rounded-xl border border-danger/40 p-4" role="alert"><p>{props.error}</p><Button disabled={!!progress || !!stems.progress} className="mt-2" onClick={props.onRetry}>Tentar análise novamente</Button></div>}
    <div className="studio-body">
      <section id="studio-lyrics" role="tabpanel" aria-labelledby="studio-tab-lyrics" hidden={tab !== 'lyrics'}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Letra e cifra</h2><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!chart || !!progress} onClick={startEdit}><Pencil className="size-4" /> Editar letra e cifra</Button><Button disabled={!chart || !!progress || busy} onClick={() => void saveCurrent()}><Save className="size-4" />{busy ? 'Salvando…' : 'Salvar cifra'}</Button><PrintChartButton content={printable} title={song.title} artist={song.artist} disabled={!chart || !!progress} /></div></div>
        {lyricsLoading ? <Loading label={lyricsTask?.label ?? 'Preparando a letra…'} fraction={lyricsTask?.fraction} /> : chart ? <div ref={printable}><ChartView chordPro={chart.chordPro} transpose={chart.transpose} fontSize={chart.fontSize} preferFlats={false} spellKey={props.shownKey} activeLineIndex={props.playing ? props.activeLine : -1} highlight="marker" autoScroll={props.autoScroll && !!props.playing && tab === 'lyrics'} onChordTap={chord => props.onChord(chord)} /><ChartChordShapes chart={{ ...chart, chordShapes: shapeChoices, chordInstrument: galleryInstrument }} spellKey={props.shownKey} onChange={(choices, instrument) => { setShapeChoices(choices); if (instrument) setGalleryInstrument(instrument); }} /></div> : <p className="text-muted-foreground">A letra e os acordes aparecerão aqui após a análise.</p>}
        {!lyricsLoading && !analysis?.lyrics && analysis && <p className="mt-5 text-sm text-muted-foreground">A transcrição não trouxe letra. Você pode editar o texto ou tentar a análise novamente.</p>}
      </section>
      <section id="studio-chords" role="tabpanel" aria-labelledby="studio-tab-chords" hidden={tab !== 'chords'}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Harmonia da música</h2><span className="text-xs text-muted-foreground">Sequência por tempo</span></div>
        {chordsLoading ? <div role="status"><p className="text-sm text-muted-foreground">{chordTask?.label ?? 'Identificando tom e acordes…'}</p><ProgressBar fraction={chordTask?.fraction} /><ChordsSkeleton /></div> : <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{chords.map((c, i) => <button key={`${c.start}-${i}`} type="button" aria-current={i === props.currentIndex ? 'true' : undefined} onClick={() => props.onSeek(c.start)} className={`rounded-xl border p-4 text-left transition-colors ${i === props.currentIndex ? 'border-primary bg-primary/15' : 'border-border bg-surface/60 hover:border-primary/50'}`}><span className="block text-xs tabular-nums text-muted-foreground">{clock(c.start)} — {clock(c.end)}</span><span className="mt-2 block text-lg font-semibold text-chord">{name(c.raw)}</span></button>)}</div>
          {!chords.length && <p className="text-muted-foreground">Nenhum acorde disponível para esta música.</p>}
        </>}
      </section>
      <section id="studio-tracks" role="tabpanel" aria-labelledby="studio-tab-tracks" hidden={tab !== 'tracks'}>
        <h2 className="mb-5 text-lg font-semibold">Tracks</h2>
        {progress ? <><p className="text-sm text-muted-foreground">Aguardando letra e acordes para iniciar a separação.</p><TracksSkeleton /></> : <StemsPanel stems={stems} title={song.title} hasAudio automaticMix mixer={tab === 'tracks' ? <StudioMixer stems={stems} onSeek={props.onSeek} getTime={props.getTime} /> : undefined} />}
      </section>
      <section id="studio-scores" role="tabpanel" aria-labelledby="studio-tab-scores" hidden={tab !== 'scores'}>
        <StudioScores song={song} chart={chart} analysis={analysis} tracks={stems.tracks} active={tab === 'scores'} waiting={!!progress || !!stems.progress} onBusyChange={props.onScoreBusyChange} />
      </section>
    </div>
    <nav className="studio-tabs" aria-label="Estúdio"><div role="tablist" aria-label="Abas do Estúdio" onKeyDown={rovingKeys} className="glass-strong flex w-full max-w-lg gap-1 rounded-2xl border border-border p-2 shadow-lg">{TABS.map(({ id, label, icon: Icon }) => <button key={id} id={`studio-tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls={`studio-${id}`} onClick={() => setTab(id)} className={`relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs sm:flex-row sm:gap-2 sm:px-2 sm:text-sm ${tab === id ? 'bg-primary/20 font-semibold text-chord' : 'text-muted-foreground hover:bg-muted'}`}><Icon className="size-4 shrink-0" />{label}{((id === 'lyrics' && lyricsLoading) || (id === 'chords' && chordsLoading) || (id === 'tracks' && !!stems.progress)) && <span aria-label="Processando" className="absolute right-1 top-1 size-1.5 animate-pulse rounded-full bg-primary" />}</button>)}</div></nav>
    {editing && <BottomSheet title="Editar letra e cifra" onClose={closeEditor} size="wide" initialFocus={panel => panel.querySelector('textarea')}>{() => <div className="overflow-auto px-4 pb-5">
      <p className="mb-3 text-sm text-muted-foreground">Escreva os acordes entre colchetes: [G]letra da música [D].</p>
      <textarea aria-label="Cifra em ChordPro" value={draft} onChange={e => setDraft(e.target.value)} disabled={busy} spellCheck={false} className="h-[42dvh] w-full resize-y rounded-xl border border-border bg-background p-4 font-mono text-base focus:border-primary" />
      {editError && <p role="alert" className="mt-3 text-sm text-danger">{editError}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2"><Button disabled={busy} variant="outline" onClick={() => void save(false)}>Aplicar alterações</Button><Button disabled={busy} onClick={() => void save(true)}>{busy ? 'Salvando…' : 'Salvar cifra na biblioteca'}</Button></div>
    </div>}</BottomSheet>}
  </section>;
};
const Loading = ({ label, fraction }: { label: string; fraction?: number }) => <div role="status"><p className="text-sm text-muted-foreground">{label}</p><ProgressBar fraction={fraction} /><LyricsSkeleton /></div>;
