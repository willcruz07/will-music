import { Music4 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Song, db, listSongs } from '../lib/db.ts';
import { deleteSavedScore, hasScoreType, SCORE_TYPES } from '../lib/score.ts';
import { confirmDialog } from '../ui/Dialog.tsx';
import { LibraryCard, LibraryBadge } from '../components/LibraryCard.tsx';

export const Scores = ({ embedded = false, query = '', onDeleted, revision = 0 }: { embedded?: boolean; query?: string; onDeleted?: () => void; revision?: number }) => {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [ready, setReady] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Map<string, { bpm: number; parts: string[] }>>(new Map());
  useEffect(() => {
    let cancelled = false;
    const metadata = new Map<string, { bpm: number; parts: string[] }>();
    void Promise.all([listSongs(), db.scores.toCollection().each(score => { metadata.set(score.songId, { bpm: score.bpm, parts: SCORE_TYPES.filter(part => hasScoreType(score, part.type)).map(part => part.type === 'choir' ? 'Coral' : part.label) }); })]).then(([list]) => {
      if (cancelled) return;
      setSongs(list);
      setSummaries(metadata); setReady(new Set(metadata.keys()));
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Não foi possível carregar as partituras.'); });
    return () => { cancelled = true; };
  }, [revision]);
  const normalized = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const visible = (songs ?? []).filter(s => ready.has(s.id) && (!query.trim() || normalized(`${s.title} ${s.artist}`).includes(normalized(query.trim()))));
  return (
    <section>
      {!embedded && <h1 className="text-3xl font-bold tracking-tight">Partituras</h1>}
      {!embedded && <p className="mt-2 max-w-2xl text-muted-foreground">
        Partituras salvas, prontas para abrir sem reprocessar o áudio. Gere novas partes na aba Partituras do Estúdio.
      </p>}
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      {songs && visible.length === 0 && (
        <div className="mt-16 max-w-md">
          <Music4 className="size-10 text-primary" />
          <p className="mt-4 text-xl font-semibold">{query ? 'Nenhuma partitura encontrada.' : 'Nenhuma partitura salva.'}</p>
          <p className="mt-2 text-muted-foreground">
            Abra um áudio no Estúdio, gere a parte desejada e use “Salvar partitura”.
          </p>
        </div>
      )}
      <ul className="library-grid mt-5">
        {visible.map(s => {
          const metadata = summaries.get(s.id);
          const count = metadata?.parts.length ?? 0;
          return <LibraryCard key={s.id} kind="score" title={s.title} artist={s.artist} to={`/musica/${s.id}/partitura`}
            description={count ? `${count} ${count === 1 ? 'parte disponível' : 'partes disponíveis'} para visualizar, tocar e imprimir.` : 'Partitura salva para leitura e estudo.'}
            badges={<>{metadata?.parts.map(part => <LibraryBadge key={part}>{part}</LibraryBadge>)}</>}
            metadata={<><span className="font-semibold text-chord">Pronta</span>{metadata?.bpm ? <span>≈ {metadata.bpm} BPM</span> : null}{s.key && <span>Tom {s.key}</span>}</>}
            deleteLabel={`Excluir partitura “${s.title}”`} deleting={!!deleting} onDelete={() => void confirmDialog({ title: 'Excluir partitura?', message: `As partes salvas de “${s.title}” serão excluídas. Áudios e cifras independentes serão mantidos.`, confirmLabel: 'Excluir' }).then(async ok => {
              if (!ok) return;
              setDeleting(s.id); setError(null);
              try { await deleteSavedScore(s.id); setReady(previous => { const next = new Set(previous); next.delete(s.id); return next; }); onDeleted?.(); }
              catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível excluir a partitura.'); }
              finally { setDeleting(null); }
            })} />;
        })}
      </ul>
    </section>
  );
};
