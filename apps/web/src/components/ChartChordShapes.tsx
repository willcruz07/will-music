import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Chart } from '../lib/db.ts';
import { chartChords, readInstrument, InstrumentToggle } from './ChordPanel.tsx';
import { ChordDiagram, INSTRUMENT_NAMES, type Instrument } from './ChordDiagram.tsx';
import { IconButton } from '../ui/Button.tsx';
import { transposeChord } from '../lib/transpose.ts';

export const ChartChordShapes = ({ chart, spellKey, onChange, defaultInstrument: chosenInstrument }: { chart: Chart; spellKey?: string; onChange: (choices: NonNullable<Chart['chordShapes']>, instrument?: Instrument) => void; defaultInstrument?: Instrument }) => {
  const chords = useMemo(() => chartChords(chart.chordPro, 0).map(source => ({ source, label: transposeChord(source, chart.transpose, spellKey ?? false) })), [chart.chordPro, chart.transpose, spellKey]);
  const [defaultInstrument] = useState(readInstrument);
  const instrument = chart.chordInstrument ?? chosenInstrument ?? Object.values(chart.chordShapes ?? {})[0]?.instrument ?? defaultInstrument;
  if (!chords.length) return null;
  return <section className="mt-8 border-t border-border pt-5" data-chart-shapes>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Acordes da música</h2><div data-no-print><InstrumentToggle value={instrument} onChange={selected => onChange(Object.fromEntries(chords.map(({ source }) => [source, { instrument: selected, variant: chart.chordShapes?.[source]?.instrument === selected ? chart.chordShapes[source]!.variant : 0 }])), selected)} /></div></div>
    <div className="flex flex-wrap items-start gap-5">{chords.map(({ source, label }) => {
      const choice = { instrument, variant: chart.chordShapes?.[source]?.instrument === instrument ? chart.chordShapes[source]!.variant : 0 };
      return <Shape key={`${label}:${instrument}`} chord={label} instrument={instrument} variant={choice.variant}
        onChange={patch => onChange({ ...chart.chordShapes, [source]: { ...choice, ...patch } }, instrument)} />;
    })}</div>
  </section>;
};
const Shape = ({ chord, instrument, variant, onChange }: { chord: string; instrument: Instrument; variant: number; onChange: (patch: Partial<{ instrument: Instrument; variant: number }>) => void }) => {
  const [count, setCount] = useState(0);
  return <div className="chart-shape-card">
    <div className="chart-shape-drawing"><ChordDiagram strict chord={chord} instrument={instrument} variant={variant} onVariants={setCount} /></div>
    <span className="flex items-center justify-center text-center text-xs text-muted-foreground">{INSTRUMENT_NAMES[instrument]}{count > 0 ? ` · ${instrument === 'teclado' ? 'Inversão' : 'Formação'} ${variant % count + 1}` : ''}</span>
    <div data-no-print className="flex items-center justify-center gap-2"><IconButton label={`Formação anterior de ${chord}`} disabled={count <= 1} onClick={() => onChange({ variant: (variant - 1 + count) % count })}><ChevronLeft className="size-4" /></IconButton><span className="text-xs tabular-nums">{count > 0 ? `${variant % count + 1}/${count}` : '—'}</span><IconButton label={`Próxima formação de ${chord}`} disabled={count <= 1} onClick={() => onChange({ variant: (variant + 1) % count })}><ChevronRight className="size-4" /></IconButton></div>
  </div>;
};
