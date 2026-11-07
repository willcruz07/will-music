import { Music, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { type Song, listSongs } from '../lib/db.ts';

const STATUS: Record<Song['analysisStatus'], string | null> = {
  pending: 'Aguardando análise',
  running: 'Analisando…',
  done: null,
  error: 'Análise com erro',
};

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const Library = () => {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void listSongs().then(setSongs);
  }, []);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return (songs ?? []).filter((s) => !q || normalize(`${s.title} ${s.artist}`).includes(q));
  }, [songs, query]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Biblioteca</h1>
        <Link
          to="/nova"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-105"
        >
          <Plus className="size-4" /> Adicionar música
        </Link>
      </div>

      {songs && songs.length > 0 && (
        <label className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por música ou artista"
            aria-label="Buscar"
            className="h-11 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
      )}

      {songs && songs.length === 0 && (
        <div className="mt-16 max-w-md">
          <Music className="size-10 text-primary" />
          <p className="mt-4 text-xl font-semibold">Sua biblioteca está vazia.</p>
          <p className="mt-2 text-muted-foreground">
            Adicione um MP3 e o will-music encontra o tom, os acordes e a letra para montar a cifra.
          </p>
        </div>
      )}

      <ul className="mt-4 divide-y divide-border">
        {visible.map((song) => (
          <li key={song.id}>
            <Link to={`/musica/${song.id}`} className="-mx-3 flex items-center gap-4 rounded-lg px-3 py-4 hover:bg-muted">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-bold text-chord">
                {song.key ?? '–'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-semibold">{song.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {song.artist || 'Artista desconhecido'}
                  {STATUS[song.analysisStatus] && (
                    <span className={song.analysisStatus === 'error' ? 'text-danger' : ''}> · {STATUS[song.analysisStatus]}</span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {songs && songs.length > 0 && visible.length === 0 && <p className="mt-6 text-muted-foreground">Nenhuma música encontrada para “{query}”.</p>}
    </section>
  );
};
