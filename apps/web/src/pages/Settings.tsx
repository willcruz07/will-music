import { useEffect, useState } from 'react';
import { ExportButton, ImportButton } from '../components/PackageButtons.tsx';
import { db } from '../lib/db.ts';
import { deleteCachedModels, listCachedModels } from '../lib/models.ts';
import { formatBytes, requestPersistence, storageStatus } from '../lib/storage.ts';
import { Button } from '../ui/Button.tsx';

const MODEL_NAMES: Record<string, string> = { chordnet: 'Acordes (ChordMini)', cqtPlan: 'Plano de frequências dos acordes', skey: 'Tom (S-KEY)' };
type Theme = 'light' | 'dark' | 'system';

const readTheme = (): Theme => {
  try {
    const t = localStorage.getItem('wm-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
};

const applyTheme = (theme: Theme) => {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', !!dark);
  try {
    if (theme === 'system') localStorage.removeItem('wm-theme');
    else localStorage.setItem('wm-theme', theme);
  } catch {
    // storage unavailable
  }
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-border py-6">
    <h2 className="text-lg font-semibold">{title}</h2>
    <div className="mt-3">{children}</div>
  </section>
);

export const Settings = () => {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [models, setModels] = useState<{ id: string; bytes: number }[] | null>(null);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted: boolean } | null>(null);
  const [songIds, setSongIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

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
                applyTheme(t);
              }}
              className={`rounded-md px-4 py-2 text-sm ${theme === t ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}
            >
              {t === 'light' ? 'Claro' : t === 'dark' ? 'Escuro' : 'Igual ao sistema'}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Modelos de análise">
        <p className="text-sm text-muted-foreground">Ficam guardados no aparelho para a análise funcionar sem internet. Apagados, voltam a ser baixados na próxima análise.</p>
        {models && models.length === 0 && <p className="mt-3">Nenhum modelo baixado ainda.</p>}
        {models && models.length > 0 && (
          <>
            <ul className="mt-3 divide-y divide-border">
              {models.map((m) => (
                <li key={m.id} className="flex justify-between py-2">
                  <span>{MODEL_NAMES[m.id] ?? m.id}</span>
                  <span className="tabular-nums text-muted-foreground">{formatBytes(m.bytes)}</span>
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
          <ExportButton songIds={songIds} title="will-music-backup" label="Exportar tudo" />
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
