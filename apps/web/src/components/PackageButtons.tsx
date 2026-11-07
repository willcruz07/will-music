import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Setlist } from '../lib/db.ts';
import { downloadBlob, exportSongs, importPackage, readPackage, safeFileName } from '../lib/package.ts';
import { Button } from '../ui/Button.tsx';

export const ExportButton = ({ songIds, title, setlist, label = 'Exportar' }: { songIds: string[]; title: string; setlist?: Setlist; label?: string }) => (
  <Button
    variant="ghost"
    onClick={() =>
      void (async () => {
        const includeAudio = confirm('Incluir o áudio no pacote? Fica maior, mas permite tocar e analisar no outro aparelho.');
        const blob = await exportSongs(songIds, { includeAudio, kind: setlist ? 'setlist' : 'song', setlist });
        downloadBlob(blob, `${safeFileName(title)}.willmusic.zip`);
      })()
    }
  >
    <Download className="size-4" /> {label}
  </Button>
);

export const ImportButton = ({ onImported }: { onImported: (message: string) => void }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        <Upload className="size-4" /> Importar
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
              const result = await importPackage(contents, async (existing) =>
                confirm(`“${existing.title}” já está na biblioteca. OK substitui pela versão do pacote; Cancelar mantém as duas.`) ? 'replace' : 'keep-both',
              );
              onImported(`${result.songs} ${result.songs === 1 ? 'música importada' : 'músicas importadas'}${result.setlist ? ` e a lista “${result.setlist.name}”` : ''}.`);
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
