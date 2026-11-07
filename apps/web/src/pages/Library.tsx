import { FolderOpen, Music, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ImportButton } from '../components/PackageButtons.tsx';
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
  const [notice, setNotice] = useState<string | null>(null);
  // null = every song, '' = songs without a folder.
  const [folder, setFolder] = useState<string | null>(null);

  useEffect(() => {
    void listSongs().then(setSongs);
  }, []);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return (songs ?? []).filter((s) => (folder === null || (s.folder ?? '') === folder) && (!q || normalize(`${s.title} ${s.artist}`).includes(q)));
  }, [songs, query, folder]);

  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of songs ?? []) counts.set(s.folder ?? '', (counts.get(s.folder ?? '') ?? 0) + 1);
    return [...counts.entries()].sort(([a], [z]) => (a === '' ? 1 : z === '' ? -1 : a.localeCompare(z)));
  }, [songs]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Biblioteca</h1>
        <div className="flex flex-wrap gap-2">
        <Link to="/pasta" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted">
          <FolderOpen className="size-4" /> Minha pasta
        </Link>
        <ImportButton
          onImported={(message) => {
            setNotice(message);
            void listSongs().then(setSongs);
          }}
        />
        </div>
      </div>
      {notice && <p className="mt-3 text-sm" role="status">{notice}</p>}

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

      {folders.length > 1 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Pastas">
          {[[null, 'Todas', songs?.length ?? 0] as const, ...folders.map(([f, n]) => [f, f || 'Sem pasta', n] as const)].map(([value, label, count]) => (
            <button
              key={value ?? '__all__'}
              type="button"
              aria-pressed={folder === value}
              onClick={() => setFolder(value)}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${folder === value ? 'border-primary bg-primary/15 font-semibold text-chord' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              {label} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {songs && songs.length === 0 && (
        <div className="mt-16 max-w-md">
          <Music className="size-10 text-primary" />
          <p className="mt-4 text-xl font-semibold">Sua biblioteca está vazia.</p>
          <p className="mt-2 text-muted-foreground">
            Adicione um MP3 e o will-music encontra o tom, os acordes e a letra para montar a cifra.
          </p>
          <Link to="/nova" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:brightness-105">
            <Plus className="size-4" /> Adicionar a primeira música
          </Link>
        </div>
      )}

      <ul className="mt-4 divide-y divide-border">
        {visible.map((song) => (
          <li key={song.id}>
            <Link to={`/musica/${song.id}`} className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-surface-2 active:bg-surface-2">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 font-[family-name:var(--font-display)] text-base font-semibold text-chord">
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
