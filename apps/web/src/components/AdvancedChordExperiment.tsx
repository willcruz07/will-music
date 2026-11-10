import { useEffect, useRef, useState } from 'react';
import type { ChordSegment } from '@will-music/engine';
import { db } from '../lib/db.ts';
import type { LvResponse } from '../worker/lvChordia.worker.ts';
import { Button } from '../ui/Button.tsx';
import { InstrumentToggle, readInstrument } from './ChordPanel.tsx';
import { ChordDiagram } from './ChordDiagram.tsx';
import { applyAdvancedChords } from '../lib/applyAdvancedChords.ts';
import { confirmDialog } from '../ui/Dialog.tsx';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export const AdvancedChordExperiment = ({ songId, chords, onPlay, onApplied, blocked }: { songId: string; chords: ChordSegment[]; onPlay: (time: number) => void; onApplied?: () => void; blocked: boolean }) => {
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState(60);
  const [length, setLength] = useState(30);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [instrument, setInstrument] = useState(readInstrument);
  const [variant, setVariant] = useState(0);
  const [variants, setVariants] = useState(0);
  const [result, setResult] = useState<{ chords: ChordSegment[]; baseline: ChordSegment[]; start: number; end: number; seconds: number } | null>(null);
  const worker = useRef<Worker | null>(null);
  const generation = useRef(0);
  const cancel = () => { generation.current++; worker.current?.terminate(); worker.current = null; setProgress(null); };
  useEffect(() => {
    let alive = true;
    void fetch('/__lv/status').then(async (response) => {
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const status = await response.json() as { ready: boolean };
        if (alive) setReady(status.ready);
      }
    }).catch(() => {});
    return () => { alive = false; generation.current++; worker.current?.terminate(); };
  }, [songId]);

  if (!ready) return null;

  const run = async () => {
    if (progress || blocked) return;
    const current = ++generation.current;
    setError(null); setNotice(null); setSelected(null); setResult(null); setProgress('Preparando trecho do áudio…');
    try {
      const record = await db.audio.get(songId);
      if (!record) throw new Error('Esta música não tem áudio.');
      const context = new OfflineAudioContext(2, 1, 22050);
      const audio = await context.decodeAudioData(await record.blob.arrayBuffer());
      if (!Number.isFinite(start) || start < 0 || start >= audio.duration) throw new Error('Escolha um início dentro da duração da música.');
      const from = Math.floor(start * 22050);
      const to = Math.min(audio.length, from + length * 22050);
      const pcm = new Float32Array(to - from);
      for (let channel = 0; channel < audio.numberOfChannels; channel++) {
        const values = audio.getChannelData(channel);
        for (let i = 0; i < pcm.length; i++) pcm[i] = pcm[i]! + values[from + i]! / audio.numberOfChannels;
      }
      if (generation.current !== current) return;
      const task = new Worker(new URL('../worker/lvChordia.worker.ts', import.meta.url), { type: 'module' });
      worker.current = task;
      task.onmessage = (event: MessageEvent<LvResponse>) => {
        if (generation.current !== current) return;
        const message = event.data;
        if (message.type === 'progress') { setProgress(message.label); return; }
        task.terminate(); worker.current = null; setProgress(null);
        if (message.type === 'error') setError(message.message);
        else setResult({ chords: message.chords.map((chord) => ({ ...chord, start: chord.start + start, end: Math.min(to / 22050, chord.end + start) })), baseline: chords.map((chord) => ({ ...chord })), start, end: to / 22050, seconds: message.seconds });
      };
      task.onerror = (event) => {
        if (generation.current !== current) return;
        task.terminate(); worker.current = null; setProgress(null); setError(event.message || 'O worker experimental falhou.');
      };
      task.postMessage({ pcm }, [pcm.buffer]);
    } catch (failure) {
      if (generation.current === current) { setError(failure instanceof Error ? failure.message : String(failure)); setProgress(null); }
    }
  };

  const sequence = (segments: ChordSegment[]) => <div className="mt-2 flex flex-wrap gap-2">{segments.map((chord, index) => (
    <button key={`${chord.start}-${index}`} type="button" onClick={() => { setSelected(chord.label); setVariant(0); onPlay(Math.max(result?.start ?? 0, chord.start)); }} className="rounded-lg border border-border px-3 py-2 text-left hover:bg-muted" title={`${clock(chord.start)}–${clock(chord.end)} · ${chord.raw}`}>
      <span className="block font-semibold text-chord">{chord.label}</span><span className="text-xs text-muted-foreground">{clock(chord.start)}</span>
    </button>
  ))}</div>;

  return <details className="mt-5 rounded-xl border border-primary/40 p-4">
    <summary className="cursor-pointer font-semibold">Laboratório de acordes · LV-Chordia experimental</summary>
    <p className="mt-3 text-sm text-muted-foreground">Análise avançada por trecho, 100% no navegador. Os modelos e filtros ficam em cache quando permitido. Compare antes de aplicar: o modelo padrão continua disponível e suas cifras editadas são preservadas.</p>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-sm">Início em segundos<input type="number" min={0} step={1} value={start} disabled={!!progress} onChange={(event) => setStart(Number(event.target.value))} className="mt-1 block h-10 w-28 rounded border border-border bg-surface px-2" /></label>
      <label className="text-sm">Duração<select value={length} disabled={!!progress} onChange={(event) => setLength(Number(event.target.value))} className="mt-1 block h-10 rounded border border-border bg-surface px-2"><option value={15}>15 segundos</option><option value={30}>30 segundos</option><option value={60}>60 segundos</option></select></label>
      <Button disabled={!!progress || blocked || applying} onClick={() => void run()}>Comparar acordes</Button>
      {progress && <Button variant="outline" onClick={cancel}>Cancelar</Button>}
    </div>
    {blocked && <p className="mt-2 text-sm text-muted-foreground">Aguarde a análise e a separação atuais terminarem.</p>}
    {progress && <p role="status" className="mt-3 text-sm">{progress}</p>}
    {error && <p role="alert" className="mt-3 whitespace-pre-wrap text-sm text-danger">{error}</p>}
    {result && <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">Trecho {clock(result.start)}–{clock(result.end)} · análise experimental em {result.seconds.toFixed(1)} s. Toque num acorde para ouvir. Os tempos das duas análises podem diferir.</p>
      <div><h3 className="text-sm font-semibold">Análise salva ao iniciar a comparação</h3>{sequence(result.baseline.filter((chord) => chord.end > result.start && chord.start < result.end))}</div>
      <div><h3 className="text-sm font-semibold">LV-Chordia — vocabulário ampliado</h3>{sequence(result.chords)}</div>
      {selected && selected !== 'N.C.' && <div className="rounded-lg bg-surface-2 p-3">
        <InstrumentToggle value={instrument} onChange={(value) => { setInstrument(value); setVariant(0); }} />
        <div className="mt-3"><ChordDiagram chord={selected} instrument={instrument} variant={variant} onVariants={setVariants} strict size="lg" /></div>
        {variants > 1 && <Button variant="outline" className="mt-2" onClick={() => setVariant((value) => (value + 1) % variants)}>Outra posição ({variant + 1}/{variants})</Button>}
        <p className="mt-2 text-xs text-muted-foreground">Sem posição compatível, o nome do acorde é mantido e o diagrama não é substituído por um acorde simplificado.</p>
      </div>}
      <Button disabled={applying || blocked || !!progress} onClick={() => void (async () => {
        if (applying) return;
        setApplying(true); setError(null);
        try {
          if (!(await confirmDialog({ title: 'Aplicar acordes deste trecho?', message: 'Os acordes da análise neste intervalo serão substituídos. A cifra gerada será atualizada; cifras editadas manualmente serão preservadas. Acordes fora do trecho não mudam.', confirmLabel: 'Aplicar ao trecho' }))) return;
          const outcome = await applyAdvancedChords(songId, result.chords, result.start, result.end);
          setNotice(outcome === 'kept-edited' ? 'Análise atualizada. Sua cifra editada foi preservada.' : 'Acordes aplicados ao trecho e cifra gerada atualizada.');
          onApplied?.();
        } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
        finally { setApplying(false); }
      })()}>{applying ? 'Aplicando…' : 'Aplicar acordes ao trecho'}</Button>
    </div>}
    {notice && <p role="status" className="mt-3 text-sm text-muted-foreground">{notice}</p>}
  </details>;
};
