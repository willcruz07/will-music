import { useMemo, useState } from 'react';
import { parseChordPro } from '../lib/chart.ts';
import { transposeChord } from '../lib/transpose.ts';
import { ChordDiagram, type Instrument } from './ChordDiagram.tsx';

const KEY = 'wm-instrument';

export const readInstrument = (): Instrument => {
  try {
    return localStorage.getItem(KEY) === 'teclado' ? 'teclado' : 'violao';
  } catch {
    return 'violao';
  }
};

/** Distinct chords of a chart (transposed and spelled for the shown key), in order of appearance. */
export const chartChords = (chordPro: string, transpose: number, spellKey?: string): string[] => {
  const seen: string[] = [];
  for (const line of parseChordPro(chordPro).lines) {
    const chords = line.kind === 'chords' ? line.chords : line.kind === 'lyric' ? line.parts.flatMap((p) => (p.chord ? [p.chord] : [])) : [];
    for (const c of chords) {
      const shown = transposeChord(c, transpose, spellKey ?? false);
      if (!seen.includes(shown)) seen.push(shown);
    }
  }
  return seen;
};

export const InstrumentToggle = ({ value, onChange }: { value: Instrument; onChange: (i: Instrument) => void }) => (
  <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Instrumento">
    {(['violao', 'teclado'] as const).map((i) => (
      <button
        key={i}
        type="button"
        role="radio"
        aria-checked={value === i}
        onClick={() => {
          onChange(i);
          try {
            localStorage.setItem(KEY, i);
          } catch {
            // storage unavailable
          }
        }}
        className={`rounded-md px-3 py-1 text-sm ${value === i ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
      >
        {i === 'violao' ? 'Violão' : 'Teclado'}
      </button>
    ))}
  </div>
);

export const ChordPanel = ({ chordPro, transpose, spellKey }: { chordPro: string; transpose: number; spellKey?: string }) => {
  const [instrument, setInstrument] = useState<Instrument>(readInstrument);
  const chords = useMemo(() => chartChords(chordPro, transpose, spellKey), [chordPro, transpose, spellKey]);
  if (chords.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Acordes da música</h2>
        <InstrumentToggle value={instrument} onChange={setInstrument} />
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {chords.map((c) => (
          <ChordDiagram key={c} chord={c} instrument={instrument} />
        ))}
      </div>
    </section>
  );
};
