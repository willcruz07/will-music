import { ChevronRight, Music4 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { type Song, db, listSongs } from '../lib/db.ts';

export const Scores = () => {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [ready, setReady] = useState<Set<string>>(new Set());
  useEffect(() => {
    void Promise.all([listSongs(), db.scores.toCollection().primaryKeys()]).then(([list, keys]) => {
      setSongs(list);
      setReady(new Set(keys as string[]));
    });
  }, []);
  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">Partituras</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        A melodia de cada música escrita em partitura, com a cifra por cima e a tablatura do violão embaixo. Abra no MuseScore pelo arquivo MusicXML.
      </p>
      {songs && songs.length === 0 && (
        <div className="mt-16 max-w-md">
          <Music4 className="size-10 text-primary" />
          <p className="mt-4 text-xl font-semibold">Nenhuma música na biblioteca.</p>
          <p className="mt-2 text-muted-foreground">
            Adicione uma música pelo botão <span className="font-semibold">+</span> e depois gere a partitura dela aqui.
          </p>
        </div>
      )}
      <ul className="mt-4 divide-y divide-border">
        {(songs ?? []).map((s) => (
          <li key={s.id}>
            <Link to={`/musica/${s.id}/partitura`} className="-mx-3 flex items-center gap-4 rounded-lg px-3 py-4 hover:bg-muted">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-semibold">{s.title}</span>
                {s.artist && <span className="block truncate text-sm text-muted-foreground">{s.artist}</span>}
              </span>
              {ready.has(s.id) ? (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-chord">Pronta</span>
              ) : (
                <span className="text-xs text-muted-foreground">Gerar</span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
