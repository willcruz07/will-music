import { useEffect, useRef, useState } from 'react';
import { SVGuitarChord } from 'svguitar';
import { chordNotes } from '../lib/chordNotation.ts';
import { type GuitarShape, guitarShapes, toSvguitar } from '../lib/chordShapes.ts';
import { CAVAQUINHO, findVoicings } from '../lib/frettedShapes.ts';

export type Instrument = 'violao' | 'teclado' | 'cavaquinho';
export const INSTRUMENT_NAMES: Record<Instrument, string> = { violao: 'Violão', teclado: 'Teclado', cavaquinho: 'Cavaquinho' };

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#13211c';

/** Shapes of a chord on a fretted instrument: the chord book for the guitar, computed for the cavaquinho. */
const frettedShapes = async (chord: string, instrument: 'violao' | 'cavaquinho'): Promise<GuitarShape[]> => {
  if (instrument === 'violao') return guitarShapes(chord);
  const pcs = chordNotes(chord);
  if (!pcs) return [];
  return findVoicings(pcs, pcs[0]!, CAVAQUINHO.tuning);
};

const Fretted = ({ chord, instrument, variant, onVariants }: { chord: string; instrument: 'violao' | 'cavaquinho'; variant: number; onVariants?: (n: number) => void }) => {
  const box = useRef<HTMLDivElement>(null);
  const [missing, setMissing] = useState(false);
  const report = useRef(onVariants);
  report.current = onVariants;
  useEffect(() => {
    let cancelled = false;
    setMissing(false);
    void frettedShapes(chord, instrument).then((shapes) => {
      const el = box.current;
      if (cancelled || !el) return;
      el.innerHTML = '';
      report.current?.(shapes.length);
      const n = Math.max(1, shapes.length);
      const shape = shapes[((variant % n) + n) % n];
      setMissing(!shape);
      if (!shape) return;
      try {
        new SVGuitarChord(el)
          .configure({
            strings: shape.frets.length,
            color: css('--foreground'),
            fingerColor: css('--chord'),
            fingerTextColor: css('--primary-foreground'),
            fontFamily: 'Atkinson Hyperlegible Next, sans-serif',
            frets: 4,
            fretSize: 1.4,
            fingerSize: 0.7,
            strokeWidth: 2,
          })
          .chord(toSvguitar(shape))
          .draw();
      } catch {
        // Rendering needs real SVG layout (not available in every environment); leave the box empty.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chord, instrument, variant]);
  // The box stays mounted (hidden when there is no shape) so the next chord can draw into it.
  return (
    <>
      {missing && <p className="text-sm text-muted-foreground">Sem diagrama para {chord}</p>}
      <div ref={box} hidden={missing} className="w-full" aria-label={`Diagrama de ${INSTRUMENT_NAMES[instrument].toLowerCase()} de ${chord}`} role="img" />
    </>
  );
};

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [1, 3, 6, 8, 10];
const BLACK_X: Record<number, number> = { 1: 0.65, 3: 1.75, 6: 3.6, 8: 4.7, 10: 5.8 };

/** Notes of the chord voiced upward from the bass across two octaves starting at C. */
const voicing = (pcs: number[]): number[] => {
  const out: number[] = [];
  for (const pc of pcs) {
    let note = pc;
    while (out.length && note <= out[out.length - 1]!) note += 12;
    if (note < 24) out.push(note);
  }
  return out;
};

/** Inversion `n` of a chord: the same notes starting from another chord tone. */
export const inversion = (pcs: number[], n: number): number[] => {
  const k = ((n % pcs.length) + pcs.length) % pcs.length;
  return [...pcs.slice(k), ...pcs.slice(0, k)];
};

const Keyboard = ({ chord, variant, onVariants }: { chord: string; variant: number; onVariants?: (n: number) => void }) => {
  const pcs = chordNotes(chord);
  const count = pcs ? Math.min(pcs.length, 4) : 0;
  const report = useRef(onVariants);
  report.current = onVariants;
  useEffect(() => report.current?.(count), [chord, count]);
  if (!pcs) return <p className="text-sm text-muted-foreground">Sem diagrama para {chord}</p>;
  const lit = new Set(voicing(inversion(pcs, variant)));
  const w = 20;
  return (
    <svg viewBox={`0 0 ${14 * w} 90`} className="w-full" role="img" aria-label={`Teclado: ${chord}`}>
      {Array.from({ length: 2 }, (_, octave) =>
        WHITE.map((pc, i) => {
          const note = octave * 12 + pc;
          return <rect key={`w${note}`} x={(octave * 7 + i) * w} y={0} width={w - 1} height={88} rx={3} fill={lit.has(note) ? 'var(--chord)' : 'var(--surface)'} stroke="var(--border)" />;
        }),
      )}
      {Array.from({ length: 2 }, (_, octave) =>
        BLACK.map((pc) => {
          const note = octave * 12 + pc;
          return <rect key={`b${note}`} x={(octave * 7 + BLACK_X[pc]!) * w} y={0} width={w * 0.62} height={54} rx={2} fill={lit.has(note) ? 'var(--chord)' : 'var(--foreground)'} stroke="var(--border)" />;
        }),
      )}
    </svg>
  );
};

/**
 * A chord drawn for the chosen instrument. `variant` picks another way to play it (another guitar
 * position, another keyboard inversion, another cavaquinho shape); `onVariants` reports how many exist.
 */
export const ChordDiagram = ({
  chord,
  instrument,
  variant = 0,
  onVariants,
  size = 'sm',
}: {
  chord: string;
  instrument: Instrument;
  variant?: number;
  onVariants?: (n: number) => void;
  size?: 'sm' | 'lg';
}) => (
  <figure className={`flex flex-col items-center ${size === 'lg' ? 'w-44' : 'w-28'}`}>
    <figcaption className="mb-1 text-lg font-bold text-chord">{chord}</figcaption>
    {instrument === 'teclado' ? <Keyboard chord={chord} variant={variant} onVariants={onVariants} /> : <Fretted chord={chord} instrument={instrument} variant={variant} onVariants={onVariants} />}
  </figure>
);
