import { useEffect, useRef, useState } from 'react';
import { isKnownChord } from '../lib/chordNotation.ts';
import { CHORD_TYPES, ROOTS, SOLFEGE } from '../lib/chordTheory.ts';
import { Button } from '../ui/Button.tsx';
import { ChordDiagram, type Instrument } from './ChordDiagram.tsx';
import { InstrumentToggle, readInstrument } from './ChordPanel.tsx';

type Props = {
  /** Chords already in the song, offered first. */
  suggestions: string[];
  title?: string;
  /** Shows "Remover acorde" (when a syllable already has one). */
  allowRemove?: boolean;
  onApply: (chord: string | null) => void;
  onCancel: () => void;
};

const parse = (chord: string) => {
  const m = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/u.exec(chord);
  return m ? { root: m[1]!, suffix: m[2] ?? '', bass: m[3] ?? '' } : { root: 'C', suffix: '', bass: '' };
};

/**
 * Chord library: pick the root, the kind and an optional bass (or type it), see how it is played,
 * and use it. The song's own chords come first so the usual ones are one tap away.
 */
export const ChordLibrary = ({ suggestions, title = 'Escolha o acorde', allowRemove = false, onApply, onCancel }: Props) => {
  const first = parse(suggestions[0] ?? 'C');
  const [root, setRoot] = useState(first.root);
  const [suffix, setSuffix] = useState(CHORD_TYPES.some((t) => t.suffix === first.suffix) ? first.suffix : '');
  const [bass, setBass] = useState('');
  const [typed, setTyped] = useState<string | null>(null);
  const [instrument, setInstrument] = useState<Instrument>(readInstrument);
  const built = `${root}${suffix}${bass && bass !== root ? `/${bass}` : ''}`;
  const chord = (typed ?? built).trim();
  const box = useRef<HTMLDivElement>(null);
  // Opened under a tall editor on phones: bring it into view.
  useEffect(() => box.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), []);

  return (
    <div ref={box} className="mt-3 scroll-mb-28 rounded-xl border border-primary bg-surface p-4" role="dialog" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <InstrumentToggle value={instrument} onChange={setInstrument} />
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Acordes desta música</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {suggestions.map((c) => (
              <button key={c} type="button" onClick={() => onApply(c)} className="min-h-9 rounded-lg bg-muted px-3 font-bold text-chord hover:brightness-110">
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Nota</p>
            <div className="mt-1 grid grid-cols-6 gap-1" role="radiogroup" aria-label="Nota do acorde">
              {ROOTS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={root === r && typed === null}
                  aria-label={`${r} (${SOLFEGE[r[0]!]}${r.length > 1 ? r[1] : ''})`}
                  onClick={() => {
                    setRoot(r);
                    setTyped(null);
                  }}
                  className={`flex min-h-11 flex-col items-center justify-center rounded-lg border text-sm ${root === r && typed === null ? 'border-primary bg-primary/15 font-semibold text-chord' : 'border-border hover:bg-muted'}`}
                >
                  {r}
                  <span className="text-[10px] leading-none text-muted-foreground">{SOLFEGE[r[0]!]}{r.length > 1 ? r[1] : ''}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tipo</p>
            <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label="Tipo do acorde">
              {CHORD_TYPES.map((t) => (
                <button
                  key={t.suffix}
                  type="button"
                  role="radio"
                  aria-checked={suffix === t.suffix && typed === null}
                  title={t.name}
                  onClick={() => {
                    setSuffix(t.suffix);
                    setTyped(null);
                  }}
                  className={`min-h-9 rounded-lg border px-2.5 text-sm ${suffix === t.suffix && typed === null ? 'border-primary bg-primary/15 font-semibold text-chord' : 'border-border hover:bg-muted'}`}
                >
                  {t.suffix || 'maior'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Baixo
              <select
                value={bass}
                onChange={(e) => {
                  setBass(e.target.value);
                  setTyped(null);
                }}
                className="h-10 rounded-lg border border-border bg-background px-2"
                aria-label="Baixo do acorde"
              >
                <option value="">Sem baixo</option>
                {ROOTS.map((r) => (
                  <option key={r} value={r}>
                    /{r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              Ou digite
              <input
                value={typed ?? built}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && chord && onApply(chord)}
                aria-label="Acorde digitado"
                className="h-10 w-32 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
              />
            </label>
          </div>
          {chord && !isKnownChord(chord) && <p className="text-sm text-danger">Acorde não reconhecido. Ele será salvo assim mesmo.</p>}
        </div>
        <div className="flex justify-center sm:block">{chord && isKnownChord(chord) && <ChordDiagram chord={chord} instrument={instrument} />}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => chord && onApply(chord)} disabled={!chord}>
          Usar {chord || 'acorde'}
        </Button>
        {allowRemove && (
          <Button variant="outline" onClick={() => onApply(null)}>
            Remover acorde
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
};
