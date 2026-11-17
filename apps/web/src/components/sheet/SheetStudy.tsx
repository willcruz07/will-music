import { Pause, Play, Repeat, Square } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Sheet } from '../../lib/sheet/model.ts';
import { sheetToMusicXml } from '../../lib/sheet/musicxml.ts';
import { Button } from '../../ui/Button.tsx';
import { type SheetPlayerState, SheetView, type SheetViewHandle } from './SheetView.tsx';

/**
 * Study mode: the student listens with the instrument's sound, follows the highlighted note, slows down, repeats a
 * passage, counts in with the metronome and can show the note names while learning to read.
 */
export const SheetStudy = ({ sheet }: { sheet: Sheet }) => {
  const view = useRef<SheetViewHandle>(null);
  const [state, setState] = useState<SheetPlayerState>({ ready: false, playing: false, speed: 1, loop: null, countIn: false, metronome: false });
  const [names, setNames] = useState(false);
  const measures = sheet.staves[0]!.measures.length;
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(Math.min(4, measures));
  const xml = useMemo(() => sheetToMusicXml(sheet, { noteNames: names }), [sheet, names]);
  const toggle = (on: boolean, cls = '') => `inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${on ? 'border-primary bg-primary/15 text-chord' : 'border-border bg-surface'} ${cls}`;

  return (
    <div>
      {sheet.instructions?.trim() && <p className="mb-3 rounded-xl border border-border bg-surface p-3 text-sm"><span className="font-semibold">Orientação: </span>{sheet.instructions}</p>}
      <div role="toolbar" aria-label="Controles de estudo" className="sticky top-14 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background/95 p-2 backdrop-blur">
        <Button disabled={!state.ready} onClick={() => view.current?.playPause()}>{state.playing ? <Pause className="size-4" /> : <Play className="size-4" />}{state.ready ? (state.playing ? 'Pausar' : 'Tocar') : 'Carregando sons…'}</Button>
        <Button variant="outline" disabled={!state.ready} onClick={() => view.current?.stop()}><Square className="size-4" /> Parar</Button>
        <label className="flex items-center gap-2 text-sm">Andamento {Math.round(state.speed * 100)}%
          <input aria-label="Andamento" type="range" min={0.25} max={1.5} step={0.05} value={state.speed} onChange={(e) => view.current?.setSpeed(Number(e.target.value))} className="w-28 accent-primary" />
        </label>
        <button type="button" aria-pressed={state.countIn} className={toggle(state.countIn)} onClick={() => view.current?.setCountIn(!state.countIn)}>Contagem</button>
        <button type="button" aria-pressed={state.metronome} className={toggle(state.metronome)} onClick={() => view.current?.setMetronome(!state.metronome)}>Metrônomo</button>
        {sheet.staffType !== 'drums' && <button type="button" aria-pressed={names} className={toggle(names)} onClick={() => setNames((v) => !v)}>Nome das notas</button>}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Repeat className="size-4 text-muted-foreground" />
        <span>Repetir do compasso</span>
        <input aria-label="Compasso inicial" type="number" min={1} max={measures} value={from} onChange={(e) => setFrom(Math.max(1, Math.min(measures, Number(e.target.value) || 1)))} className="min-h-10 w-16 rounded-lg border border-border bg-background px-2" />
        <span>ao</span>
        <input aria-label="Compasso final" type="number" min={1} max={measures} value={to} onChange={(e) => setTo(Math.max(1, Math.min(measures, Number(e.target.value) || 1)))} className="min-h-10 w-16 rounded-lg border border-border bg-background px-2" />
        {state.loop
          ? <Button variant="outline" onClick={() => view.current?.setLoop(null)}>Parar de repetir ({state.loop.from}–{state.loop.to})</Button>
          : <Button variant="outline" disabled={!state.ready} onClick={() => view.current?.setLoop({ from: Math.min(from, to), to: Math.max(from, to) })}>Repetir trecho</Button>}
      </div>
      {state.error && <p role="alert" className="mb-2 text-sm text-danger">{state.error}</p>}
      <SheetView xml={xml} interactive handle={view} onState={setState} />
      <p className="mt-2 text-xs text-muted-foreground">Toque na partitura para começar daquele ponto. Comece devagar e aumente o andamento quando tocar sem erros.</p>
    </div>
  );
};
