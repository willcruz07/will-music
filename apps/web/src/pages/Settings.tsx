import { useEffect, useState } from 'react';
import { ExportButton, ImportButton } from '../components/PackageButtons.tsx';
import { InstallApp } from '../components/PwaPrompts.tsx';
import { db } from '../lib/db.ts';
import { deleteCachedModel, deleteCachedModels, downloadAllModels, listCachedModels } from '../lib/models.ts';
import { formatBytes, requestPersistence, storageStatus } from '../lib/storage.ts';
import { useThemePref } from '../lib/theme.ts';
import { Button } from '../ui/Button.tsx';

const MODEL_NAMES: Record<string, string> = { chordnet: 'Acordes (ChordMini)', cqtPlan: 'Plano de frequências dos acordes', skey: 'Tom (S-KEY)', kara2Core: 'Separação de faixas (estrutura)', kara2Data: 'Separação de faixas (pesos)', basicPitch: 'Notas da partitura (Basic Pitch)', demucs6s: 'Separação em 4 e 6 faixas (HTDemucs)' };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-border py-6">
    <h2 className="text-lg font-semibold">{title}</h2>
    <div className="mt-3">{children}</div>
  </section>
);

export const Settings = () => {
  const [theme, setTheme] = useThemePref();
  const [models, setModels] = useState<{ id: string; bytes: number }[] | null>(null);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted: boolean } | null>(null);
  const [songIds, setSongIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const refresh = () => {
    void listCachedModels().then(setModels).catch(() => setModels([]));
    void storageStatus().then(setStorage);
    void db.songs.toCollection().primaryKeys().then((keys) => setSongIds(keys as string[]));
  };
  useEffect(refresh, []);

  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>

      <Section title="Tema">
        <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Tema">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => {
                setTheme(t);
              }}
              className={`rounded-md px-4 py-2 text-sm ${theme === t ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
            >
              {t === 'light' ? 'Claro' : t === 'dark' ? 'Escuro' : 'Igual ao sistema'}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Aplicativo">
        <p className="mb-3 text-sm text-muted-foreground">Instalado, o will-music abre como um app, em tela cheia, e funciona sem internet no ensaio ou na igreja.</p>
        <InstallApp />
      </Section>

      <Section title="Modelos de análise">
        <p className="text-sm text-muted-foreground">Ficam guardados no aparelho para a análise funcionar sem internet. Apagados, voltam a ser baixados na próxima análise.</p>
        {models && models.length === 0 && <p className="mt-3">Nenhum modelo baixado ainda.</p>}
        <Button
          className="mt-3"
          variant="outline"
          disabled={!!downloading}
          onClick={() => {
            setDownloading('Começando');
            void downloadAllModels((done, total) => setDownloading(`Baixando ${formatBytes(done)} de ${formatBytes(total)}`))
              .then(() => setNotice('Todos os modelos estão no aparelho: a análise, a separação e as partituras funcionam sem internet. A transcrição da letra (Whisper) baixa na primeira vez que for usada.'))
              .catch((e: unknown) => setNotice(e instanceof Error ? e.message : 'O download falhou.'))
              .finally(() => {
                setDownloading(null);
                refresh();
              });
          }}
        >
          {downloading ?? 'Baixar todos os modelos'}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">Para deixar tudo pronto antes de um ensaio sem internet (cerca de 550 MB).</p>
        {models && models.length > 0 && (
          <>
            <ul className="mt-3 divide-y divide-border">
              {models.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 flex-1">{MODEL_NAMES[m.id] ?? m.id}</span>
                  <span className="tabular-nums text-muted-foreground">{formatBytes(m.bytes)}</span>
                  <button type="button" className="rounded-lg px-2 py-1 text-sm text-danger hover:bg-muted" aria-label={`Apagar ${MODEL_NAMES[m.id] ?? m.id}`} onClick={() => void deleteCachedModel(m.id as never).then(refresh)}>
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-3" onClick={() => void deleteCachedModels().then(refresh)}>
              Apagar modelos
            </Button>
          </>
        )}
      </Section>

      <Section title="Armazenamento">
        {storage?.usage !== undefined && storage.quota !== undefined && (
          <p>
            Usando {formatBytes(storage.usage)} de {formatBytes(storage.quota)}.
          </p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          {storage?.persisted ? 'Seus dados estão protegidos contra limpeza automática do navegador.' : 'O navegador pode apagar os dados se o aparelho ficar sem espaço.'}
        </p>
        {!storage?.persisted && (
          <Button variant="outline" className="mt-3" onClick={() => void requestPersistence().then(refresh)}>
            Proteger meus dados
          </Button>
        )}
      </Section>

      <Section title="Backup">
        <p className="text-sm text-muted-foreground">Exporte tudo para guardar ou levar para outro aparelho. O pacote abre em qualquer navegador com o will-music.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ExportButton songIds={songIds} title="will-music-backup" backup label="Exportar tudo" onError={setNotice} />
          <ImportButton
            onImported={(message) => {
              setNotice(message);
              refresh();
            }}
          />
        </div>
        {notice && (
          <p className="mt-3 text-sm" role="status">
            {notice}
          </p>
        )}
      </Section>
    </section>
  );
};
