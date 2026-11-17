import { ArrowLeft, Download, GraduationCap, Minus, Plus, Printer, Redo2, Share2, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { SheetView, type SheetViewHandle } from '../components/sheet/SheetView.tsx';
import { SheetShare } from '../components/sheet/SheetShare.tsx';
import { downloadText } from '../lib/score.ts';
import {
  addMeasures, addPitch, clampCursor, type Cursor, deleteAt, type EditResult, nearestPitch, placeEvent, removeMeasure,
  setChordSymbol, setDynamic, setFingering, stepCursor, switchStaff, tieForward, toggleArticulation, toggleDot, transposeAt,
} from '../lib/sheet/edit.ts';
import { type Articulation, DRUM_LABELS, DRUM_PIECES, type DrumPiece, type DurationName, type Dynamic, isDrum, NOTE_NAMES, type Sheet, type SheetEvent, STEPS, type Step } from '../lib/sheet/model.ts';
import { sheetToMusicXml } from '../lib/sheet/musicxml.ts';
import { deleteSheet, getSheet, saveSheet } from '../lib/sheet/store.ts';
import { Button, IconButton } from '../ui/Button.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';

const FIGURES: { duration: DurationName; label: string; glyph: string; key: string }[] = [
  { duration: 'whole', label: 'Semibreve', glyph: '𝅝', key: '5' },
  { duration: 'half', label: 'Mínima', glyph: '𝅗𝅥', key: '4' },
  { duration: 'quarter', label: 'Semínima', glyph: '♩', key: '3' },
  { duration: 'eighth', label: 'Colcheia', glyph: '♪', key: '2' },
  { duration: 'sixteenth', label: 'Semicolcheia', glyph: '𝅘𝅥𝅯', key: '1' },
];
const ARTICULATIONS: { id: Articulation; label: string; glyph: string }[] = [
  { id: 'accent', label: 'Acento', glyph: '>' }, { id: 'staccato', label: 'Staccato', glyph: '·' }, { id: 'tenuto', label: 'Tenuto', glyph: '–' }, { id: 'fermata', label: 'Fermata', glyph: '𝄐' },
];
const DYNAMICS: Dynamic[] = ['pp', 'p', 'mp', 'mf', 'f', 'ff'];
const LETTER_KEYS: Record<string, Step> = { c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', a: 'A', b: 'B' };

const chip = (active: boolean) => `inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-2 text-sm font-semibold transition-colors ${active ? 'border-primary bg-primary/15 text-chord' : 'border-border bg-surface hover:bg-muted'}`;

/** The score editor: duration first, then the note; measures always stay complete. */
export const SheetEditor = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [missing, setMissing] = useState(false);
  const [cursor, setCursor] = useState<Cursor>({ staff: 0, measure: 0, event: 0 });
  const [selected, setSelected] = useState<Cursor | null>(null);
  const [figure, setFigure] = useState<{ duration: DurationName; dots: 0 | 1; triplet: boolean }>({ duration: 'quarter', dots: 0, triplet: false });
  const [chordMode, setChordMode] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const past = useRef<Sheet[]>([]);
  const future = useRef<Sheet[]>([]);
  const view = useRef<SheetViewHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void getSheet(id).then((s) => { if (s) setSheet(s); else setMissing(true); });
  }, [id]);

  // Saved on the device shortly after each change.
  useEffect(() => {
    if (!sheet) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveSheet(sheet); }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [sheet]);

  const xml = useMemo(() => (sheet ? sheetToMusicXml(sheet) : ''), [sheet]);
  const drums = sheet?.staffType === 'drums';

  const commit = useCallback((result: EditResult, opts: { hear?: boolean } = {}) => {
    if (result.error) { setNotice(result.error); return; }
    setNotice(null);
    setSheet((current) => {
      if (current && result.sheet !== current) { past.current.push(current); if (past.current.length > 200) past.current.shift(); future.current = []; }
      return result.sheet;
    });
    setCursor(clampCursor(result.sheet, result.cursor));
    const sel = result.placed ?? (result.sheet !== sheet ? selected : null);
    if (result.placed) setSelected(result.placed);
    if (opts.hear && sel) setTimeout(() => view.current?.preview(sel), 120);
  }, [sheet, selected]);

  const target = selected ?? cursor;
  const value = (): Pick<SheetEvent, 'duration' | 'dots' | 'triplet'> => ({ duration: figure.duration, dots: figure.triplet ? 0 : figure.dots, ...(figure.triplet ? { triplet: true as const } : {}) });

  const enterStep = (step: Step, addToChord = chordMode) => {
    if (!sheet) return;
    if (addToChord && selected) { commit(addPitch(sheet, selected, nearestPitch(sheet, selected, step)), { hear: true }); return; }
    commit(placeEvent(sheet, cursor, { kind: 'note', ...value(), pitches: [nearestPitch(sheet, cursor, step)] }), { hear: true });
  };
  const enterDrum = (drum: DrumPiece, addToChord = chordMode) => {
    if (!sheet) return;
    if (addToChord && selected) { commit(addPitch(sheet, selected, { drum }), { hear: true }); return; }
    commit(placeEvent(sheet, cursor, { kind: 'note', ...value(), pitches: [{ drum }] }), { hear: true });
  };
  const enterRest = () => { if (sheet) commit(placeEvent(sheet, cursor, { kind: 'rest', ...value() })); };
  const undo = () => { const prev = past.current.pop(); if (!prev || !sheet) return; future.current.push(sheet); setSheet(prev); setCursor((c) => clampCursor(prev, c)); setSelected(null); };
  const redo = () => { const next = future.current.pop(); if (!next || !sheet) return; past.current.push(sheet); setSheet(next); setCursor((c) => clampCursor(next, c)); setSelected(null); };
  const pick = (at: Cursor) => { setCursor(at); setSelected(at); setNotice(null); };

  // Keyboard on a computer: letters for notes, numbers for figures, arrows to move and change pitch.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!sheet || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (mod && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (mod && key === 'y') { event.preventDefault(); redo(); return; }
      if (mod && key === '3') { event.preventDefault(); setFigure((f) => ({ ...f, triplet: !f.triplet, dots: 0 })); return; }
      if (mod && (key === 'arrowup' || key === 'arrowdown')) { event.preventDefault(); commit(transposeAt(sheet, target, key === 'arrowup' ? 12 : -12), { hear: true }); return; }
      if (mod || event.altKey) return;
      if (!drums && LETTER_KEYS[key]) { event.preventDefault(); enterStep(LETTER_KEYS[key]!, event.shiftKey || chordMode); return; }
      const fig = FIGURES.find((f) => f.key === key);
      if (fig) { event.preventDefault(); setFigure((f) => ({ ...f, duration: fig.duration, dots: fig.duration === 'sixteenth' ? 0 : f.dots })); return; }
      if (key === '0') { event.preventDefault(); enterRest(); return; }
      if (key === '.') { event.preventDefault(); if (selected) commit(toggleDot(sheet, selected)); else setFigure((f) => ({ ...f, dots: f.dots ? 0 : 1 })); return; }
      if (key === 't' && selected) { event.preventDefault(); commit(tieForward(sheet, selected, value()), { hear: true }); return; }
      if (key === 'arrowright' || key === 'arrowleft') { event.preventDefault(); const next = stepCursor(sheet, cursor, key === 'arrowright' ? 1 : -1); setCursor(next); setSelected(next); return; }
      if (key === 'arrowup' || key === 'arrowdown') { event.preventDefault(); commit(transposeAt(sheet, target, key === 'arrowup' ? 1 : -1), { hear: true }); return; }
      if (key === 'delete' || key === 'backspace') { event.preventDefault(); commit(deleteAt(sheet, target)); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (missing) return <section><p className="mt-6">Esta partitura não está neste aparelho.</p><Link to="/?aba=partituras" className="mt-3 inline-block font-semibold text-chord">Voltar às partituras</Link></section>;
  if (!sheet) return <p role="status" className="mt-6 animate-pulse text-muted-foreground">Abrindo a partitura…</p>;

  const event = sheet.staves[target.staff]?.measures[target.measure]?.events[target.event];
  const measures = sheet.staves[0]!.measures.length;

  return (
    <section className="pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/?aba=partituras" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-chord"><ArrowLeft className="size-4" /> Partituras</Link>
        <span className="flex-1" />
        <Button variant="outline" onClick={() => navigate(`/partitura/${sheet.id}/estudar`)}><GraduationCap className="size-4" /> Estudar</Button>
        <Button variant="outline" onClick={() => setSharing(true)}><Share2 className="size-4" /> {sheet.shared ? (sheet.shared.dirty ? 'Publicar alterações' : 'Compartilhada') : 'Compartilhar'}</Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input aria-label="Título" value={sheet.title} onChange={(e) => setSheet({ ...sheet, title: e.target.value.slice(0, 120), updatedAt: new Date().toISOString(), ...(sheet.shared ? { shared: { ...sheet.shared, dirty: true } } : {}) })} className="min-h-11 rounded-xl border border-border bg-background px-3 font-[family-name:var(--font-display)] text-xl font-semibold" />
        <input aria-label="Orientação para o aluno" placeholder="Orientação para o aluno (opcional)" value={sheet.instructions ?? ''} onChange={(e) => setSheet({ ...sheet, instructions: e.target.value.slice(0, 200), updatedAt: new Date().toISOString(), ...(sheet.shared ? { shared: { ...sheet.shared, dirty: true } } : {}) })} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm" />
      </div>
      {sheet.shared?.dirty && <p className="mt-2 text-xs text-muted-foreground" role="status">Há alterações não publicadas: o aluno ainda vê a versão anterior.</p>}

      {/* Figures and actions. */}
      <div role="toolbar" aria-label="Figuras e ações" className="sticky top-14 z-10 mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-background/95 p-2 backdrop-blur">
        {FIGURES.map((f) => (
          <button key={f.duration} type="button" aria-label={`${f.label} (tecla ${f.key})`} aria-pressed={figure.duration === f.duration} title={`${f.label} · tecla ${f.key}`} className={`${chip(figure.duration === f.duration)} text-xl`} onClick={() => setFigure((x) => ({ ...x, duration: f.duration, dots: f.duration === 'sixteenth' ? 0 : x.dots }))}>{f.glyph}</button>
        ))}
        <button type="button" aria-pressed={!!figure.dots} title="Ponto · tecla ." className={chip(!!figure.dots)} disabled={figure.triplet || figure.duration === 'sixteenth'} onClick={() => (selected ? commit(toggleDot(sheet, selected)) : setFigure((x) => ({ ...x, dots: x.dots ? 0 : 1 })))}>•</button>
        <button type="button" aria-pressed={figure.triplet} title="Tercina · Ctrl+3" className={chip(figure.triplet)} onClick={() => setFigure((x) => ({ ...x, triplet: !x.triplet, dots: 0 }))}>3</button>
        <span className="mx-1 h-8 w-px bg-border" />
        <button type="button" title="Pausa · tecla 0" className={chip(false)} onClick={enterRest}>𝄽</button>
        <button type="button" title="Ligadura · tecla T" className={chip(false)} disabled={!selected} onClick={() => selected && commit(tieForward(sheet, selected, value()), { hear: true })}>‿</button>
        {!drums && <>
          <button type="button" title="Meio tom acima · ↑" className={chip(false)} onClick={() => commit(transposeAt(sheet, target, 1), { hear: true })}>♯</button>
          <button type="button" title="Meio tom abaixo · ↓" className={chip(false)} onClick={() => commit(transposeAt(sheet, target, -1), { hear: true })}>♭</button>
          <button type="button" title="Oitava acima · Ctrl+↑" className={chip(false)} onClick={() => commit(transposeAt(sheet, target, 12), { hear: true })}>8↑</button>
          <button type="button" title="Oitava abaixo · Ctrl+↓" className={chip(false)} onClick={() => commit(transposeAt(sheet, target, -12), { hear: true })}>8↓</button>
        </>}
        <button type="button" aria-pressed={chordMode} title="Acrescentar à nota selecionada (acorde) · Shift+letra" className={chip(chordMode)} onClick={() => setChordMode((v) => !v)}>{drums ? 'Junto' : 'Acorde'}</button>
        <span className="mx-1 h-8 w-px bg-border" />
        <IconButton label="Apagar (vira pausa)" onClick={() => commit(deleteAt(sheet, target))}><Trash2 className="size-4" /></IconButton>
        <IconButton label="Desfazer" disabled={!past.current.length} onClick={undo}><Undo2 className="size-4" /></IconButton>
        <IconButton label="Refazer" disabled={!future.current.length} onClick={redo}><Redo2 className="size-4" /></IconButton>
        {sheet.staffType === 'piano' && <Button variant="outline" className="min-h-11" onClick={() => { const next = switchStaff(sheet, cursor); setCursor(next); setSelected(null); }}>{cursor.staff === 0 ? 'Mão direita' : 'Mão esquerda'}</Button>}
      </div>

      {/* Note entry: a one-octave keyboard, or the drum kit. */}
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label={drums ? 'Peças da bateria' : 'Notas'}>
        {drums
          ? DRUM_PIECES.map((d) => <button key={d} type="button" className={`${chip(false)} px-3`} onClick={() => enterDrum(d)}>{DRUM_LABELS[d]}</button>)
          : STEPS.map((step) => <button key={step} type="button" title={`${NOTE_NAMES[step]} · tecla ${step}`} className={`${chip(false)} min-w-12 flex-col leading-tight`} onClick={() => enterStep(step)}><span>{NOTE_NAMES[step]}</span><span className="text-[10px] font-normal text-muted-foreground">{step}</span></button>)}
      </div>
      {notice && <p role="alert" className="mt-2 text-sm text-danger">{notice}</p>}

      <div className="mt-3">
        <SheetView xml={xml} cursor={cursor} selected={selected} onPick={pick} handle={view} />
      </div>

      {/* Marks for the selected note. */}
      <details className="mt-3 rounded-2xl border border-border bg-surface p-3" open>
        <summary className="cursor-pointer text-sm font-semibold">Marcações da nota selecionada</summary>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {ARTICULATIONS.map((a) => <button key={a.id} type="button" title={a.label} aria-pressed={!!event?.articulations?.includes(a.id)} className={chip(!!event?.articulations?.includes(a.id))} onClick={() => commit(toggleArticulation(sheet, target, a.id))}>{a.glyph}<span className="sr-only">{a.label}</span></button>)}
          <span className="mx-1 h-8 w-px bg-border" />
          {DYNAMICS.map((d) => <button key={d} type="button" aria-pressed={event?.dynamic === d} className={`${chip(event?.dynamic === d)} italic`} onClick={() => commit(setDynamic(sheet, target, event?.dynamic === d ? null : d))}>{d}</button>)}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Cifra acima
            <input key={`c-${target.staff}-${target.measure}-${target.event}`} defaultValue={event?.chordSymbol ?? ''} placeholder="Ex.: Am7" onBlur={(e) => commit(setChordSymbol(sheet, target, e.target.value))} className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          {!drums && <label className="text-sm">Dedilhado (da nota mais grave para a mais aguda)
            <input key={`f-${target.staff}-${target.measure}-${target.event}`} defaultValue={event?.pitches?.filter((p) => !isDrum(p)).map((p) => ('fingering' in p ? p.fingering ?? '' : '')).join(' ').trim() ?? ''} placeholder="Ex.: 1 3 5" onBlur={(e) => commit(setFingering(sheet, target, e.target.value))} className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-background px-3" />
          </label>}
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{measures} {measures === 1 ? 'compasso' : 'compassos'}</span>
        <Button variant="outline" onClick={() => { past.current.push(sheet); setSheet(addMeasures(sheet, 4)); }}><Plus className="size-4" /> 4 compassos</Button>
        <Button variant="outline" disabled={measures <= 1} onClick={() => { const next = removeMeasure(sheet, cursor.measure); past.current.push(sheet); setSheet(next); setCursor(clampCursor(next, { ...cursor, event: 0 })); setSelected(null); }}><Minus className="size-4" /> Remover compasso {cursor.measure + 1}</Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={() => downloadText(sheetToMusicXml(sheet), `${sheet.title || 'partitura'}.musicxml`, 'application/vnd.recordare.musicxml+xml')}><Download className="size-4" /> MusicXML</Button>
        <Button variant="ghost" onClick={() => view.current?.print()}><Printer className="size-4" /> Imprimir</Button>
        <Button variant="ghost" onClick={() => void confirmDialog({ title: 'Excluir partitura?', message: 'Ela sai deste aparelho. Uma cópia compartilhada continua no link até você parar de compartilhar.', confirmLabel: 'Excluir', cancelLabel: 'Manter' }).then(async (ok) => { if (ok) { await deleteSheet(sheet.id); navigate('/?aba=partituras'); } })}><Trash2 className="size-4" /> Excluir</Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">No computador: escolha a figura (1 a 5), digite a nota (C D E F G A B), 0 para pausa, ponto com “.”, T liga, setas ↑↓ mudam meio tom, Ctrl+↑↓ a oitava, Shift+letra forma acorde, Ctrl+Z desfaz.</p>

      {sharing && <SheetShare sheet={sheet} onChange={setSheet} onClose={() => setSharing(false)} />}
    </section>
  );
};
