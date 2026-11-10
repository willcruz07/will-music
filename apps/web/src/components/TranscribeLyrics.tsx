import { Mic } from 'lucide-react';
import { useState } from 'react';
import type { LyricsChoice } from '../lib/lyricsApply.ts';
import { describeTranscription } from '../lib/transcript.ts';
import { transcribeSong } from '../lib/whisper.ts';
import { Button } from '../ui/Button.tsx';
import { ProgressBar } from './AnalysisProgress.tsx';

export const TranscribeLyrics = ({ songId, hasStems, onApply }: { songId: string; hasStems: boolean; onApply: (lyrics: LyricsChoice) => void }) => {
  const [status, setStatus] = useState<{ label: string; fraction?: number; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const gpu = !!(navigator as Navigator & { gpu?: unknown }).gpu;
  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold">Transcrever a letra do áudio</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O Whisper escuta a voz isolada, quando disponível, e escreve a letra com o tempo de cada linha. Na primeira vez baixa o modelo: cerca de 300 MB onde há WebGPU, ou uma versão mais leve, de cerca de 80 MB, em aparelhos sem WebGPU.
        {!hasStems && ' Sem separar a voz, a transcrição erra mais.'}
        {!gpu && ' Este navegador não tem WebGPU: vai funcionar, mas pode levar muitos minutos.'}
      </p>
      <Button
        className="mt-3"
        variant="outline"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setStatus({ label: 'Preparando o áudio' });
          void transcribeSong(songId, (p) => setStatus(describeTranscription(p)))
            .then(({ lines }) => {
              setStatus(null);
              onApply({ source: 'manual', lines });
            })
            .catch((e: unknown) => setStatus({ label: e instanceof Error ? e.message : 'A transcrição falhou.' }))
            .finally(() => setBusy(false));
        }}
      >
        <Mic className="size-4" /> {busy ? 'Transcrevendo…' : 'Transcrever a letra'}
      </Button>
      {status && (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="text-sm">{status.label}</p>
          {busy && <ProgressBar fraction={status.fraction} />}
          {status.detail && <p className="mt-1 truncate text-xs italic text-muted-foreground">{status.detail}</p>}
        </div>
      )}
    </div>
  );
};
