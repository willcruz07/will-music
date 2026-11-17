import { Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import type { Sheet } from '../../lib/sheet/model.ts';
import { useOnline } from '../../lib/online.ts';
import { BottomSheet } from '../../ui/BottomSheet.tsx';
import { Button } from '../../ui/Button.tsx';
import { confirmDialog } from '../../ui/Dialog.tsx';

/** Teacher → student: publish the score behind a link, update it with "Publicar alterações", or stop sharing. */
export const SheetShare = ({ sheet, onChange, onClose }: { sheet: Sheet; onChange: (sheet: Sheet) => void; onClose: () => void }) => {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const run = (work: () => Promise<void>) => { setBusy(true); setError(null); void work().catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível concluir.')).finally(() => setBusy(false)); };
  const publish = () => run(async () => {
    const api = await import('../../lib/cloud/sheets.ts');
    const result = await api.publishSheet(sheet);
    onChange({ ...sheet, shared: { id: result.id, publishedAt: result.publishedAt, dirty: false } });
  });
  const url = sheet.shared ? `${location.origin}/partitura/compartilhada/${encodeURIComponent(sheet.shared.id)}` : '';
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: sheet.title, text: `Partitura para estudar: ${sheet.title}`, url }); return; } catch { /* fall back to copying */ } }
    await navigator.clipboard?.writeText(url); setCopied(true);
  };
  return (
    <BottomSheet title="Compartilhar com alunos" onClose={onClose}>
      {() => (
        <div className="space-y-3 px-4 pb-5 text-sm">
          <p className="text-muted-foreground">Quem tiver o link e estiver com a conta aberta vê a partitura no modo de estudo e pode salvar uma cópia. Suas edições só chegam ao aluno quando você publica.</p>
          {!sheet.shared ? (
            <Button disabled={busy || !online} onClick={publish}><Share2 className="size-4" /> {busy ? 'Publicando…' : 'Criar link de compartilhamento'}</Button>
          ) : (
            <>
              <div className="flex gap-2"><input readOnly value={url} aria-label="Link da partitura" className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 text-xs" onFocus={(e) => e.target.select()} /><Button variant="outline" onClick={() => void share()}><Copy className="size-4" /> {copied ? 'Copiado' : 'Enviar link'}</Button></div>
              <p className="text-xs text-muted-foreground">{sheet.shared.dirty ? 'Há alterações não publicadas.' : `Publicada em ${new Date(sheet.shared.publishedAt).toLocaleString('pt-BR')}.`}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !online || !sheet.shared.dirty} onClick={publish}>{busy ? 'Publicando…' : 'Publicar alterações'}</Button>
                <Button variant="ghost" disabled={busy || !online} onClick={() => void confirmDialog({ title: 'Parar de compartilhar?', message: 'O link deixa de funcionar. Quem já salvou uma cópia continua com ela.', confirmLabel: 'Parar', cancelLabel: 'Manter' }).then((ok) => {
                  if (!ok || !sheet.shared) return;
                  const id = sheet.shared.id;
                  run(async () => { const api = await import('../../lib/cloud/sheets.ts'); await api.unpublishSheet(id); const { shared: _s, ...rest } = sheet; onChange(rest as Sheet); });
                })}>Parar de compartilhar</Button>
              </div>
            </>
          )}
          {!online && <p className="text-xs text-muted-foreground">Conecte-se para publicar.</p>}
          {error && <p role="alert" className="text-danger">{error}</p>}
        </div>
      )}
    </BottomSheet>
  );
};
