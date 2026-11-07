import { ChevronLeft, ChevronRight, GraduationCap, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { chordNotes } from '../lib/chordNotation.ts';
import { pcOf, spellChordTones } from '../lib/chordTheory.ts';
import { ChordDiagram, type Instrument } from './ChordDiagram.tsx';
import { InstrumentToggle, readInstrument } from './ChordPanel.tsx';

/** Note names of a chord, each spelled by its letter from the root (Gm is G Bb D, not G A# D). */
export const chordNoteNames = (chord: string): string[] => {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/u.exec(chord.trim());
  const pcs = chordNotes(chord);
  if (!m || !pcs) return [];
  const root = m[1]!;
  const rootPc = pcOf(root);
  const dim7 = /°7|º7|dim7/u.test(m[2]!);
  return pcs.map((pc, i) => (m[3] && i === 0 && pc !== rootPc ? m[3] : spellChordTones(root, [(pc - rootPc + 12) % 12], dim7)[0]!));
};

const FORM_LABEL: Record<Instrument, string> = { violao: 'Forma', teclado: 'Inversão', cavaquinho: 'Forma' };

/**
 * How to play a chord, opened by tapping it in the chart: its notes, a diagram for the chosen
 * instrument and the other ways to play it.
 */
export const ChordHelp = ({ chord, anchor, onClose }: { chord: string; anchor?: DOMRect; onClose: () => void }) => {
  const [instrument, setInstrument] = useState<Instrument>(readInstrument);
  const [variant, setVariant] = useState(0);
  const [count, setCount] = useState(0);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => setVariant(0), [chord, instrument]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: PointerEvent) => !card.current?.contains(e.target as Node) && onClose();
    window.addEventListener('keydown', onKey);
    // Next tick: the tap that opened the card must not close it.
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  // Next to the chord on large screens; a card above the bottom bar on phones.
  const wide = typeof window !== 'undefined' && window.innerWidth >= 640;
  const style =
    wide && anchor
      ? { left: Math.min(Math.max(8, anchor.left - 40), window.innerWidth - 296), top: anchor.bottom + 8 > window.innerHeight - 380 ? Math.max(8, anchor.top - 380) : anchor.bottom + 8 }
      : undefined;
  const notes = chordNoteNames(chord);

  return (
    <div
      ref={card}
      role="dialog"
      aria-label={`Como tocar ${chord}`}
      style={style}
      className={`z-40 w-72 rounded-2xl border border-border bg-surface p-4 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.55)] ${style ? 'fixed' : 'fixed inset-x-0 mx-auto bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom)+6rem)]'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-chord">{chord}</p>
          {notes.length > 0 && <p className="text-sm text-muted-foreground">Notas: {notes.join(' · ')}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="-mr-1 inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2">
        <InstrumentToggle value={instrument} onChange={setInstrument} />
      </div>
      <div className="mt-3 flex justify-center">
        <ChordDiagram chord={chord} instrument={instrument} variant={variant} onVariants={setCount} size="lg" />
      </div>
      {count > 1 && (
        <div className="mt-2 flex items-center justify-between text-sm">
          <button type="button" aria-label="Forma anterior" onClick={() => setVariant((v) => (v - 1 + count) % count)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
            <ChevronLeft className="size-5" />
          </button>
          <span className="tabular-nums text-muted-foreground">
            {FORM_LABEL[instrument]} {variant + 1} de {count}
          </span>
          <button type="button" aria-label="Próxima forma" onClick={() => setVariant((v) => (v + 1) % count)} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
      <Link to={`/estudo?acorde=${encodeURIComponent(chord)}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-chord underline-offset-2 hover:underline">
        <GraduationCap className="size-4" /> Entender este acorde
      </Link>
    </div>
  );
};
