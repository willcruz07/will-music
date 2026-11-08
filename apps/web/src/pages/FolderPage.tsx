import { FileMusic, FileText, FolderOpen, FolderSync, Package, RefreshCw, Unplug } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ScoreView } from '../components/ScoreView.tsx';
import {
  type DirLike,
  type FoundFile,
  folderAccess,
  folderSync,
  folderPrefs,
  forgetFolder,
  getFolder,
  pickFolder,
  restoreFiles,
  scanFileList,
  scanFolder,
  setFolderPrefs,
  supportsFolderAccess,
  writeAllToFolder,
} from '../lib/folder.ts';
import { exportSongs } from '../lib/package.ts';
import { downloadBlob } from '../lib/download.ts';
import { db } from '../lib/db.ts';
import { Button } from '../ui/Button.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';

const ICON = { package: Package, chordpro: FileText, musicxml: FileMusic } as const;
const KIND = { package: 'Pacote', chordpro: 'Cifra', musicxml: 'Partitura' } as const;

/**
 * The user's own folder: the app writes every chart, score and package there as plain files and can
 * read them back, so the music survives even if the browser clears its data or the phone is replaced.
 */
export const FolderPage = () => {
  const canConnect = supportsFolderAccess();
  const [dir, setDir] = useState<DirLike | null>(null);
  const [granted, setGranted] = useState(false);
  const [prefs, setPrefs] = useState({ auto: true, audio: true });
  const [found, setFound] = useState<FoundFile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ name: string; xml: string } | null>(null);
  const [pending, setPending] = useState(0);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      setPrefs(await folderPrefs());
      setPending((await folderSync.pending()).length);
      const saved = await getFolder();
      if (saved) {
        setDir(saved);
        setGranted(await folderAccess(saved, false));
      }
    })();
  }, []);

  const run = async (label: string, job: () => Promise<string | void>) => {
    setBusy(label);
    setNotice(null);
    try {
      const message = await job();
      if (message) setNotice(message);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setNotice(e instanceof Error ? e.message : 'Não deu certo. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  const ensureAccess = async (d: DirLike) => {
    const ok = await folderAccess(d, true);
    setGranted(ok);
    if (ok) {
      await folderSync.flush();
      setPending(0);
    }
    if (!ok) throw new Error('Sem permissão para usar a pasta. Toque de novo e escolha "Permitir".');
  };

  const connect = () =>
    run('Conectando', async () => {
      const d = await pickFolder();
      setDir(d);
      setGranted(true);
      return `Pasta "${d.name}" conectada. Use "Salvar tudo agora" para guardar as músicas que já existem.`;
    });

  const saveAll = () =>
    run('Salvando', async () => {
      if (!dir) return;
      await ensureAccess(dir);
      await writeAllToFolder(dir, { includeAudio: prefs.audio }, (done, total) => setBusy(`Salvando ${done} de ${total}`));
      setFound(await scanFolder(dir));
      return 'Tudo salvo na pasta: cifras, partituras, pacotes e um backup das listas.';
    });

  const scan = () =>
    run('Lendo a pasta', async () => {
      if (!dir) return;
      await ensureAccess(dir);
      setFound(await scanFolder(dir));
    });

  const restore = (files: FoundFile[]) =>
    run('Restaurando', async () => {
      const result = await restoreFiles(files, async (conflicts) =>
        (await confirmDialog({ title: 'Já estão no app', message: `${conflicts.length} música(s) já estão no app. Substituir pelas da pasta ou manter as duas?`, confirmLabel: 'Substituir', cancelLabel: 'Manter as duas' })) ? 'replace' : 'keep-both',
      );
      return `Restauradas ${result.songs} música(s)${result.lists ? ` e ${result.lists} lista(s)` : ''}.${result.skipped ? ` ${result.skipped} arquivo(s) já estavam no app ou não puderam ser lidos.` : ''}`;
    });

  const open = async (f: FoundFile) => {
    if (f.kind === 'musicxml') setViewing({ name: f.name, xml: await (await f.file()).text() });
    else void restore([f]);
  };

  const updatePrefs = (next: typeof prefs) => {
    setPrefs(next);
    void setFolderPrefs(next);
  };

  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Minha pasta</h1>
      <p className="mt-2 text-muted-foreground">
        Guarde suas músicas como arquivos numa pasta do aparelho: cifras (.cho), partituras (.musicxml) e pacotes completos (.willmusic.zip). Se o navegador apagar os dados, ou se
        você trocar de aparelho, é só ler a pasta de novo. Os arquivos também podem ser enviados para outra pessoa.
      </p>

      {canConnect ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          {dir ? (
            <>
              <p className="flex items-center gap-2 font-semibold">
                <FolderSync className="size-5 text-primary" /> Pasta conectada: {dir.name}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {granted ? 'O app pode gravar nela.' : 'O navegador pede permissão a cada visita: toque em um dos botões abaixo para permitir.'}
                {pending > 0 && ` ${pending} alteração(ões) ainda não foram gravadas na pasta: elas serão gravadas quando você permitir.`}
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={prefs.auto} onChange={(e) => updatePrefs({ ...prefs, auto: e.target.checked })} className="size-4 accent-[var(--primary)]" />
                  Salvar automaticamente quando uma cifra ou partitura mudar
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={prefs.audio} onChange={(e) => updatePrefs({ ...prefs, audio: e.target.checked })} className="size-4 accent-[var(--primary)]" />
                  Incluir o áudio nos pacotes (ocupa mais espaço, mas permite restaurar a música inteira)
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => void saveAll()} disabled={!!busy}>
                  <FolderSync className="size-4" /> {busy?.startsWith('Salvando') ? busy : 'Salvar tudo agora'}
                </Button>
                <Button variant="outline" onClick={() => void scan()} disabled={!!busy}>
                  <RefreshCw className="size-4" /> Ver o que está na pasta
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void forgetFolder().then(() => {
                      setDir(null);
                      setFound(null);
                    })
                  }
                >
                  <Unplug className="size-4" /> Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">Conecte uma pasta do computador</p>
              <p className="mt-1 text-sm text-muted-foreground">Escolha (ou crie) uma pasta, por exemplo "Documentos/will-music". O app grava tudo nela e mantém atualizada.</p>
              <Button className="mt-3" onClick={() => void connect()} disabled={!!busy}>
                <FolderOpen className="size-4" /> Escolher a pasta
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <p className="font-semibold">Neste aparelho</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Este navegador não grava direto numa pasta (isso funciona no Chrome e no Edge do computador). Aqui você baixa um pacote com tudo e guarda onde quiser (Arquivos, Drive,
            WhatsApp) e, para restaurar, escolhe a pasta onde os arquivos estão.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={!!busy}
              onClick={() =>
                void run('Gerando', async () => {
                  const ids = (await db.songs.toCollection().primaryKeys()) as string[];
                  downloadBlob(await exportSongs(ids, { includeAudio: prefs.audio, kind: 'backup', setlists: await db.setlists.toArray() }), 'will-music-backup.willmusic.zip');
                  return 'Pacote baixado. Guarde-o na pasta que preferir.';
                })
              }
            >
              <Package className="size-4" /> {busy === 'Gerando' ? 'Gerando…' : 'Baixar tudo'}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border p-5">
        <p className="font-semibold">Ler uma pasta com arquivos do will-music</p>
        <p className="mt-1 text-sm text-muted-foreground">Mostra as cifras, partituras e pacotes de uma pasta para abrir ou restaurar, mesmo os que vieram de outra pessoa.</p>
        <input
          ref={folderInput}
          type="file"
          multiple
          className="sr-only"
          aria-label="Escolher pasta para ler"
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          onChange={(e) => setFound(scanFileList(e.target.files ?? []))}
        />
        <Button variant="outline" className="mt-3" onClick={() => folderInput.current?.click()}>
          <FolderOpen className="size-4" /> Escolher pasta para ler
        </Button>
      </div>

      {(busy || notice) && (
        <p className="mt-4 text-sm" role="status">
          {busy ?? notice}
        </p>
      )}

      {found && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{found.length ? `${found.length} arquivo(s) encontrados` : 'Nenhum arquivo do will-music nesta pasta'}</h2>
            {found.length > 0 && (
              <Button onClick={() => void restore(found)} disabled={!!busy}>
                Restaurar tudo
              </Button>
            )}
          </div>
          <ul className="mt-2 divide-y divide-border">
            {found.map((f) => {
              const Icon = ICON[f.kind];
              return (
                <li key={f.path} className="flex items-center gap-3 py-2.5">
                  <Icon className="size-5 shrink-0 text-chord" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{f.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {KIND[f.kind]} · {f.path}
                    </span>
                  </span>
                  <Button variant="ghost" className="min-h-9 px-3" onClick={() => void open(f)} disabled={!!busy}>
                    {f.kind === 'musicxml' ? 'Ver' : 'Importar'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {viewing && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{viewing.name}</h2>
            <Button variant="ghost" onClick={() => setViewing(null)}>
              Fechar
            </Button>
          </div>
          <ScoreView xml={viewing.xml} />
        </div>
      )}
    </section>
  );
};
