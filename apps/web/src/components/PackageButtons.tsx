import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { type Setlist, db } from '../lib/db.ts';
import { downloadBlob, exportSongs, importPackage, readPackage, safeFileName } from '../lib/package.ts';
import { Button } from '../ui/Button.tsx';

type ExportProps = { songIds: string[]; title: string; setlist?: Setlist; backup?: boolean; label?: string; onError?: (message: string) => void };

export const ExportButton = ({ songIds, title, setlist, backup = false, label = 'Exportar', onError }: ExportProps) => {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() =>
        void (async () => {
          const includeAudio = confirm('Incluir o áudio no pacote? Fica maior, mas permite tocar e analisar no outro aparelho.');
          setBusy(true);
          try {
            const setlists = backup ? await db.setlists.toArray() : setlist ? [setlist] : [];
            const blob = await exportSongs(songIds, { includeAudio, kind: backup ? 'backup' : setlist ? 'setlist' : 'song', setlists });
            downloadBlob(blob, `${safeFileName(title)}.willmusic.zip`);
          } catch {
            const message = 'Não foi possível montar o pacote. Se a biblioteca for grande, tente exportar sem o áudio.';
            if (onError) onError(message);
            else alert(message);
          } finally {
            setBusy(false);
          }
        })()
      }
    >
      <Download className="size-4" /> {busy ? 'Preparando…' : label}
    </Button>
  );
};

export const ImportButton = ({ onImported }: { onImported: (message: string) => void }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        <Upload className="size-4" /> {busy ? 'Importando…' : 'Importar'}
      </Button>
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        className="sr-only"
        aria-label="Pacote do will-music"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          void (async () => {
            try {
              const contents = await readPackage(file);
              const result = await importPackage(contents, async (conflicts) => {
                const names = conflicts.length === 1 ? `“${conflicts[0]!.title}” já está` : `${conflicts.length} músicas do pacote já estão`;
                return confirm(`${names} na biblioteca. OK substitui pela versão do pacote; Cancelar mantém as duas.`) ? 'replace' : 'keep-both';
              });
              const lists = result.setlists.length ? ` e ${result.setlists.length === 1 ? `a lista “${result.setlists[0]!.name}”` : `${result.setlists.length} listas`}` : '';
              onImported(`${result.songs} ${result.songs === 1 ? 'música importada' : 'músicas importadas'}${lists}.`);
            } catch (error) {
              onImported(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.');
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    </>
  );
};
