import { lazy, Suspense, useMemo, useState } from 'react';
import { notationExample, type StudyScore } from './notation.ts';
import { PlayButton, useStudySynth } from './widgets.tsx';

const ScoreView = lazy(() => import('../components/ScoreView.tsx').then(m => ({ default: m.ScoreView })));

export const NotationBlock = ({ score, caption, id, synth }: { score: StudyScore; caption: string; id: string; synth: ReturnType<typeof useStudySynth> }) => {
  const [visible, setVisible] = useState(false);
  const [bpm, setBpm] = useState(score.bpm);
  const example = useMemo(() => notationExample({ ...score, bpm }), [score, bpm]);
  return <figure className="my-4 min-w-0 rounded-2xl border border-border bg-surface p-4">
    <figcaption className="font-semibold">{caption}</figcaption>
    <p className="mt-1 text-xs text-muted-foreground">{score.meter.join('/')} · {score.pulse === 'dotted-quarter' ? 'Semínima pontuada' : 'Semínima'} = {bpm} BPM · {score.parts.map(p => p.name).join(' / ')}</p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button type="button" aria-expanded={visible} onClick={() => setVisible(v => !v)} className="min-h-10 rounded-lg border border-border px-3 text-sm">{visible ? 'Recolher partitura' : 'Abrir partitura'}</button>
      <PlayButton label={caption} active={synth.playing === id} onClick={() => synth.play(id, example.events, 0, example.duration)} />
      <label className="flex items-center gap-2 text-sm">Andamento <input aria-label={`Andamento: ${caption}`} type="range" min={40} max={160} step={5} value={bpm} onChange={e => { synth.stop(); setBpm(Number(e.target.value)); }} className="w-24 accent-primary" /></label>
    </div>
    {visible && <Suspense fallback={<p role="status" className="mt-4 animate-pulse text-sm text-muted-foreground">Preparando a escrita musical…</p>}><ScoreView xml={example.xml} /></Suspense>}
    <p className="mt-2 text-xs text-muted-foreground">Abra a escrita e acompanhe o som. Conte também as pausas; o áudio é uma referência sintetizada.</p>
  </figure>;
};
