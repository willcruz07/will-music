import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ExportButton, ImportButton } from '../components/PackageButtons.tsx';
import { AboutButton } from '../components/About.tsx';
import { InstallApp } from '../components/PwaPrompts.tsx';
import { db } from '../lib/db.ts';
import { deleteCachedModel, deleteCachedModels, downloadAllModels, listCachedModels } from '../lib/models.ts';
import { formatBytes, hasPredictableQuota, storageStatus } from '../lib/storage.ts';
import { StorageProtection } from '../components/StorageProtection.tsx';
import { useThemePref } from '../lib/theme.ts';
import { Button } from '../ui/Button.tsx';
import { rovingKeys } from '../lib/a11y.ts';
import { readExecutionPreference, saveExecutionPreference, type ExecutionPreference } from '../lib/analysisExecution.ts';

const MODEL_NAMES: Record<string, string> = { lv0: 'Acordes (LV-Chordia 1/5)', lv1: 'Acordes (LV-Chordia 2/5)', lv2: 'Acordes (LV-Chordia 3/5)', lv3: 'Acordes (LV-Chordia 4/5)', lv4: 'Acordes (LV-Chordia 5/5)', lvPlans: 'Planos de frequência (LV-Chordia)', lvDictionary: 'Dicionário (LV-Chordia)', chordnet: 'Acordes (ChordMini)', cqtPlan: 'Plano de frequências dos acordes', skey: 'Tom (S-KEY)', kara2Core: 'Separação de faixas (estrutura)', kara2Data: 'Separação de faixas (pesos)', basicPitch: 'Notas da partitura (Basic Pitch)', demucs6s: 'Separação em 4 e 6 faixas (HTDemucs)' };

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
  const [execution, setExecution] = useState(readExecutionPreference);

  const refresh = () => {
    void listCachedModels().then(setModels).catch(() => setModels([]));
    void storageStatus().then(setStorage);
    void db.songs.toCollection().primaryKeys().then((keys) => setSongIds(keys as string[]));
  };
  useEffect(refresh, []);

  return (
    <section className="max-w-2xl">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">Ajustes</h1>
      <Section title="Conta e catálogo">
        <p className="text-sm text-muted-foreground">Gerencie a conta Google usada para acessar o will-music. As cifras salvas neste aparelho continuam disponíveis offline; a biblioteca não é sincronizada automaticamente.</p>
        <Link to="/conta" className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-chord">Entrar ou gerenciar conta</Link>
      </Section>

      <Section title="Tema">
        <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" onKeyDown={rovingKeys} aria-label="Tema">
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

      <Section title="Processamento das músicas">
        <label className="block text-sm font-semibold">Acordes e transcrição
          <select aria-label="Execução das análises" value={execution} onChange={(event) => {
            const value = event.target.value as ExecutionPreference;
            setExecution(value); saveExecutionPreference(value);
          }} className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-surface px-3">
            <option value="auto">Automático</option>
            <option value="parallel">Em paralelo — testar as duas tarefas juntas</option>
            <option value="sequential">Uma tarefa por vez</option>
          </select>
        </label>
        <p className="mt-2 text-sm text-muted-foreground">No automático, iPhone e iPad executam uma tarefa por vez. Em computadores com GPU disponível e ao menos quatro processadores lógicos, o app permite execução paralela. O modo paralelo é experimental e pode usar mais memória. Após a letra e os acordes, o app inicia a separação de faixas quando há GPU compatível. No iPhone ou iPad, pede confirmação antes de separar.</p>
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
            {hasPredictableQuota(storage)
              ? `Uso estimado: ${formatBytes(storage.usage)}. O navegador informa uma cota padronizada por privacidade; o limite real disponível não é informado.`
              : `Usando ${formatBytes(storage.usage)} de uma cota estimada de ${formatBytes(storage.quota)}.`}
          </p>
        )}
        <StorageProtection />
      </Section>

      <Section title="Seus dados">
        <div className="flex flex-wrap gap-2">
          <Link to="/pasta" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-muted">
            Minha pasta (salvar e restaurar arquivos)
          </Link>
          <Link to="/armazenamento" className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-muted">
            Espaço por música
          </Link>
        </div>
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

      <Section title="Sobre">
        <AboutButton variant="row" />
      </Section>
    </section>
  );
};
