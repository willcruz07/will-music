import { useEffect, useRef, useState } from 'react';
import { SVGuitarChord } from 'svguitar';
import { chordNotes } from '../lib/chordNotation.ts';
import { guitarShape, toSvguitar } from '../lib/chordShapes.ts';

export type Instrument = 'violao' | 'teclado';

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#13211c';

const Guitar = ({ chord }: { chord: string }) => {
  const box = useRef<HTMLDivElement>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setMissing(false);
    void guitarShape(chord).then((shape) => {
      const el = box.current;
      if (cancelled || !el) return;
      el.innerHTML = '';
      setMissing(!shape);
      if (!shape) return;
      try {
        new SVGuitarChord(el)
          .configure({ color: css('--foreground'), fingerColor: css('--chord'), fingerTextColor: css('--primary-foreground'), fontFamily: 'Atkinson Hyperlegible Next, sans-serif', frets: 4, fretSize: 1.4, fingerSize: 0.7, strokeWidth: 2 })
          .chord(toSvguitar(shape))
          .draw();
      } catch {
        // Rendering needs real SVG layout (not available in every environment); leave the box empty.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chord]);
  // The box stays mounted (hidden when there is no shape) so the next chord can draw into it.
  return (
    <>
      {missing && <p className="text-sm text-muted-foreground">Sem diagrama para {chord}</p>}
      <div ref={box} hidden={missing} className="w-full" aria-label={`Diagrama de violão de ${chord}`} role="img" />
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

const Keyboard = ({ chord }: { chord: string }) => {
  const pcs = chordNotes(chord);
  if (!pcs) return <p className="text-sm text-muted-foreground">Sem diagrama para {chord}</p>;
  const lit = new Set(voicing(pcs));
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

export const ChordDiagram = ({ chord, instrument }: { chord: string; instrument: Instrument }) => (
  <figure className="flex w-28 flex-col items-center">
    <figcaption className="mb-1 text-lg font-bold text-chord">{chord}</figcaption>
    {instrument === 'violao' ? <Guitar chord={chord} /> : <Keyboard chord={chord} />}
  </figure>
);
