import { Play } from 'lucide-react';
import { Button } from '../ui/Button.tsx';

export type StartMode = 'major' | 'minor';
export type StartChoice = { pc: number; mode: StartMode };

// Each pitch spelled the way its key is usually written: Db major but C#m, Ab major but G#m.
const MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
const PT = ['Dó', 'Dó♯/Ré♭', 'Ré', 'Ré♯/Mi♭', 'Mi', 'Fá', 'Fá♯/Sol♭', 'Sol', 'Sol♯/Lá♭', 'Lá', 'Lá♯/Si♭', 'Si'];

/** The starting chord of a choice: a major seventh chord or a minor seventh, the kinds the constellation starts from. */
export const startChord = ({ pc, mode }: StartChoice): string => (mode === 'major' ? `${MAJOR[pc]}7M` : `${MINOR[pc]}m7`);

/** How a pitch row is titled: one name, or both spellings when the modes spell it differently (Db · C#). */
const rowName = (pc: number) => (MAJOR[pc] === MINOR[pc] ? MAJOR[pc]! : `${MAJOR[pc]} · ${MINOR[pc]}`);

/**
 * Where the constellation starts: the twelve notes, one under the other, each with a small Maior | Menor switch;
 * one radio group for all of them, and a Começar button that says which chord opens.
 */
export const StartPicker = ({ value, onChange, onStart }: { value: StartChoice; onChange: (c: StartChoice) => void; onStart: () => void }) => (
  <div className="mt-6">
    <fieldset>
      <legend className="text-sm text-muted-foreground">Acorde de partida: escolha a nota e se começa maior ou menor</legend>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {MAJOR.map((_, pc) => {
          const active = value.pc === pc;
          return (
            <li key={pc} className={`flex items-center gap-3 px-3 py-2 transition-colors ${active ? 'bg-primary/10' : ''}`}>
              <span className={`size-2 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${active ? 'text-chord' : ''}`}>{rowName(pc)}</span>
                <span className="block text-xs text-muted-foreground">{PT[pc]}</span>
              </span>
              <span className="inline-flex shrink-0 rounded-full border border-border bg-background p-0.5">
                {(['major', 'minor'] as const).map((mode) => {
                  const on = active && value.mode === mode;
                  const chord = startChord({ pc, mode });
                  return (
                    <label
                      key={mode}
                      className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary ${on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <input type="radio" name="partida" className="sr-only" checked={on} onChange={() => onChange({ pc, mode })} aria-label={`${chord}, ${PT[pc]} ${mode === 'major' ? 'maior' : 'menor'}`} />
                      {mode === 'major' ? 'Maior' : 'Menor'}
                    </label>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </fieldset>
    {/* Kept in reach under a long list on phones. */}
    <div className="sticky bottom-0 -mx-4 mt-4 bg-gradient-to-t from-background via-background to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
      <Button className="min-h-12 w-full text-base" onClick={onStart}>
        <Play className="size-4" /> Começar em {startChord(value)}
      </Button>
    </div>
  </div>
);
