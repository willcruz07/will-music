import { Archive, Layers, Minimize2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { formatBytes, storageStatus } from '../lib/storage.ts';
import { type SongStorage, compactAudio, deleteAllStems, keepOnlyChart, songStorage } from '../lib/storageManager.ts';
import { Button } from '../ui/Button.tsx';
import { confirmDialog } from '../ui/Dialog.tsx';

/** Space used per song, with ways to free it without losing the chart, the scores or the lists. */
export const StoragePage = () => {
  const [rows, setRows] = useState<SongStorage[] | null>(null);
  const [status, setStatus] = useState<{ usage?: number; quota?: number; persisted: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => {
    void songStorage().then(setRows);
    void storageStatus().then(setStatus);
  };
  useEffect(refresh, []);

  const act = (id: string, label: string, job: () => Promise<string>) => {
    setBusy(id);
    setNotice(null);
    void job()
      .then(setNotice)
      .catch((e: unknown) => setNotice(e instanceof Error ? e.message : `Não foi possível ${label}.`))
      .finally(() => {
        setBusy(null);
        refresh();
      });
  };

  const total = rows?.reduce((n, r) => n + r.total, 0) ?? 0;

  return (
    <section className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Espaço por música</h1>
      <p className="mt-2 text-muted-foreground">
        O áudio e as faixas separadas são o que ocupa espaço. Cifras, partituras e listas são pequenas e nunca são apagadas por aqui. Antes de liberar espaço, se quiser, guarde tudo em{' '}
        <Link to="/pasta" className="font-semibold text-chord underline underline-offset-2">
          Minha pasta
        </Link>
        .
      </p>
      {status?.quota !== undefined && (
        <p className="mt-3 text-sm">
          Áudio e faixas: <span className="font-semibold">{formatBytes(total)}</span> · Total do app: {formatBytes(status.usage ?? 0)} de {formatBytes(status.quota)} permitidos
        </p>
      )}
      {notice && (
        <p className="mt-3 text-sm" role="status">
          {notice}
        </p>
      )}
      <ul className="mt-4 divide-y divide-border">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link to={`/musica/${r.id}`} className="min-w-0 truncate font-semibold hover:underline">
                {r.title}
                {r.artist && <span className="font-normal text-muted-foreground"> · {r.artist}</span>}
              </Link>
              <span className="text-sm tabular-nums text-muted-foreground">
                {r.total ? formatBytes(r.total) : 'só a cifra'}
                {r.audio > 0 && ` · áudio ${formatBytes(r.audio)}`}
                {r.stems > 0 && ` · faixas ${formatBytes(r.stems)}`}
              </span>
            </div>
            {r.total > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {r.audio > 3e6 && (
                  <Button
                    variant="ghost"
                    className="min-h-9 px-3"
                    disabled={!!busy}
                    onClick={() =>
                      act(r.id, 'compactar', async () => {
                        const saved = await compactAudio(r.id);
                        return saved ? `Áudio de "${r.title}" compactado: ${formatBytes(saved)} a menos.` : `O áudio de "${r.title}" já está compacto.`;
                      })
                    }
                  >
                    <Minimize2 className="size-4" /> {busy === r.id ? 'Trabalhando…' : 'Compactar áudio'}
                  </Button>
                )}
                {r.stems > 0 && (
                  <Button
                    variant="ghost"
                    className="min-h-9 px-3"
                    disabled={!!busy}
                    onClick={() =>
                      void confirmDialog({ title: 'Apagar as faixas?', message: `As faixas separadas de "${r.title}" saem do aparelho. Dá para separar de novo depois.`, confirmLabel: 'Apagar' }).then(
                        (ok) => ok && act(r.id, 'apagar as faixas', async () => (await deleteAllStems(r.id), 'Faixas apagadas.')),
                      )
                    }
                  >
                    <Layers className="size-4" /> Apagar faixas
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="min-h-9 px-3 text-danger"
                  disabled={!!busy}
                  onClick={() =>
                    void confirmDialog({ title: 'Manter só a cifra?', message: `O áudio e as faixas de "${r.title}" saem do aparelho; a cifra, as partituras e as listas ficam.`, confirmLabel: 'Liberar espaço' }).then((ok) => ok &&
                    act(r.id, 'liberar o espaço', async () => (await keepOnlyChart(r.id), `"${r.title}" agora guarda só a cifra e as partituras.`)))
                  }
                >
                  <Archive className="size-4" /> Manter só a cifra
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};
