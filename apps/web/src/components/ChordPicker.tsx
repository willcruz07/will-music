import { useState } from 'react';
import { isKnownChord } from '../lib/chordNotation.ts';
import { Button } from '../ui/Button.tsx';

type Props = { suggestions: string[]; onApply: (chord: string | null) => void; onCancel: () => void };

export const ChordPicker = ({ suggestions, onApply, onCancel }: Props) => {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  return (
    <div className="mt-3 rounded-lg border border-primary bg-surface p-3">
      <label className="block text-sm font-semibold" htmlFor="chord-input">
        Acorde nesta sílaba
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          id="chord-input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && trimmed && onApply(trimmed)}
          placeholder="Ex.: G, Em7, D/F#"
          className="h-10 w-40 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
        />
        <Button onClick={() => trimmed && onApply(trimmed)} disabled={!trimmed}>
          Aplicar
        </Button>
        <Button variant="outline" onClick={() => onApply(null)}>
          Remover acorde
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {trimmed && !isKnownChord(trimmed) && <p className="mt-2 text-sm text-danger">Acorde não reconhecido. Ele será salvo assim mesmo.</p>}
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((c) => (
            <button key={c} type="button" onClick={() => onApply(c)} className="rounded-lg bg-muted px-3 py-1 font-bold text-chord">
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
