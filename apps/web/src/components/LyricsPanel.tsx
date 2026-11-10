import { useState } from 'react';
import { distributePlainLyrics } from '../lib/lrclib.ts';
import type { LyricsChoice } from '../lib/lyricsApply.ts';
import { Button } from '../ui/Button.tsx';

type Props = {
  durationSec: number;
  onApply: (lyrics: LyricsChoice) => void;
};

export const LyricsPanel = ({ durationSec, onApply }: Props) => {
  const [pasted, setPasted] = useState('');

  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold">Letra</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cole uma letra para substituir a transcrição. Você pode ajustar a sincronização depois.</p>
      <label className="mt-6 block">
        <span className="text-sm font-semibold">Colar a letra</span>
        <textarea
          aria-label="Colar a letra"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder="Uma linha da música por linha"
          className="mt-1 w-full rounded-lg border border-border bg-surface p-3 outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </label>
      <Button
        variant="outline"
        className="mt-2"
        disabled={!pasted.trim()}
        onClick={() => onApply({ source: 'manual', lines: distributePlainLyrics(pasted, durationSec) })}
      >
        Usar a letra colada
      </Button>
    </div>
  );
};
