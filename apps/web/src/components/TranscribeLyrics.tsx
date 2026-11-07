import { Mic } from 'lucide-react';
import { useState } from 'react';
import type { LyricsChoice } from '../lib/lyricsApply.ts';
import { transcribeSong } from '../lib/whisper.ts';
import { Button } from '../ui/Button.tsx';

export const TranscribeLyrics = ({ songId, hasStems, onApply }: { songId: string; hasStems: boolean; onApply: (lyrics: LyricsChoice) => void }) => {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gpu = !!(navigator as Navigator & { gpu?: unknown }).gpu;
  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold">Transcrever a letra do áudio</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Para músicas que não estão no LRCLIB. O Whisper escuta a música e escreve a letra com o tempo de cada linha. Na primeira vez baixa cerca de 300 MB.
        {!hasStems && ' Sem separar a voz, a transcrição erra mais.'}
        {!gpu && ' Este navegador não tem WebGPU: vai funcionar, mas pode levar muitos minutos.'}
      </p>
      <Button
        className="mt-3"
        variant="outline"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setStatus('Preparando o áudio');
          void transcribeSong(songId, (loaded, total) => setStatus(total && loaded < total ? `Baixando o Whisper (${Math.round(loaded / 1e6)} MB de ${Math.round(total / 1e6)} MB)` : 'Transcrevendo… pode levar alguns minutos.'))
            .then(({ lines }) => {
              setStatus(null);
              onApply({ source: 'manual', lines });
            })
            .catch((e: unknown) => setStatus(e instanceof Error ? e.message : 'A transcrição falhou.'))
            .finally(() => setBusy(false));
        }}
      >
        <Mic className="size-4" /> {busy ? 'Transcrevendo…' : 'Transcrever a letra'}
      </Button>
      {status && (
        <p className="mt-2 text-sm" role="status">
          {status}
        </p>
      )}
    </div>
  );
};
