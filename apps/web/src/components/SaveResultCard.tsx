import { CheckCircle2, Save } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/db.ts';
import { diagnoseAudioImport } from '../lib/importDiagnostics.ts';
import { getPendingAnalysis } from '../lib/pendingAnalysis.ts';
import { savePendingAnalysis } from '../lib/saveAnalysis.ts';
import { getSessionStems } from '../lib/sessionStems.ts';
import { formatBytes } from '../lib/storage.ts';
import { Button } from '../ui/Button.tsx';
import { ExportButton } from './PackageButtons.tsx';

/**
 * The studio's result lives in this session until it is saved: this card says so plainly and saves the chart,
 * the lyrics and the separated tracks together. Export and the storage diagnosis are the fallbacks for a refused save.
 */
export const SaveResultCard = ({ songId, title, onSaved }: { songId: string; title: string; onSaved: () => Promise<unknown> | void }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const pending = getPendingAnalysis(songId);
  const stems = getSessionStems(songId);
  const stemBytes = stems?.tracks.reduce((n, t) => n + t.blob.size, 0) ?? 0;
  const kept = [
    'Cifra com tom e acordes',
    pending?.analysis.lyrics?.lines.length ? 'Letra sincronizada' : null,
    stems ? `${stems.tracks.length} faixas separadas (${formatBytes(stemBytes)})` : null,
  ].filter(Boolean) as string[];

  const save = () => {
    setSaving(true);
    setError(null);
    void savePendingAnalysis(songId)
      .then(() => onSaved())
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'O navegador recusou a gravação.'))
      .finally(() => setSaving(false));
  };

  return (
    <section className="progress-fade mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4" aria-labelledby="save-result-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="save-result-title" className="text-base font-semibold">Resultado pronto</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">ainda não salvo</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Por enquanto ele está só nesta sessão. Salve para abrir a música depois sem analisar de novo.</p>
      <ul className="mt-3 space-y-1 text-sm">
        {kept.map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden /> {item}</li>)}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={saving || diagnosing} onClick={save}><Save className="size-4" /> {saving ? 'Salvando…' : 'Salvar na biblioteca'}</Button>
        <ExportButton songIds={[songId]} title={title} label="Exportar pacote" />
      </div>
      {error && <div className="mt-3 rounded-lg border border-danger/40 p-3 text-sm" role="alert">
        <p className="font-semibold text-danger">Não foi possível salvar neste aparelho.</p>
        <p className="mt-1 text-muted-foreground">{error} O resultado continua nesta sessão: tente de novo ou exporte o pacote para não perder.</p>
        <Button className="mt-2" variant="outline" disabled={diagnosing} onClick={() => {
          setDiagnosing(true);
          void (async () => {
            const audio = await db.audio.get(songId);
            setDiagnostic(await diagnoseAudioImport(getPendingAnalysis(songId)?.error, { size: audio?.blob.size ?? 0, type: audio?.mimeType ?? '' }));
          })().catch((e: unknown) => setDiagnostic(String(e))).finally(() => setDiagnosing(false));
        }}>{diagnosing ? 'Verificando o armazenamento…' : 'Verificar o armazenamento'}</Button>
      </div>}
      {diagnostic && <textarea readOnly aria-label="Diagnóstico de armazenamento" value={diagnostic} rows={8} className="mt-3 w-full rounded-lg border border-border bg-surface p-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />}
    </section>
  );
};
