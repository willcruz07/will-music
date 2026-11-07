import { Search } from 'lucide-react';
import { useState } from 'react';
import { type LrclibResult, distributePlainLyrics, parseLrc, searchLyrics } from '../lib/lrclib.ts';
import type { LyricsChoice } from '../lib/lyricsApply.ts';
import { Button } from '../ui/Button.tsx';

type Props = {
  title: string;
  artist: string;
  durationSec: number;
  onApply: (lyrics: LyricsChoice) => void;
  search?: (title: string, artist: string) => Promise<LrclibResult[]>;
};

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

const field = 'mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary';

export const LyricsPanel = ({ title, artist, durationSec, onApply, search = searchLyrics }: Props) => {
  const [qTitle, setQTitle] = useState(title);
  const [qArtist, setQArtist] = useState(artist);
  const [results, setResults] = useState<LrclibResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');

  const run = async () => {
    setBusy(true);
    setResults(await search(qTitle.trim(), qArtist.trim()));
    setBusy(false);
  };

  const choose = (r: LrclibResult) =>
    onApply({
      source: 'lrclib',
      lrclibId: r.id,
      lines: r.syncedLyrics ? parseLrc(r.syncedLyrics) : distributePlainLyrics(r.plainLyrics ?? '', durationSec),
    });

  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-border p-4">
      <h2 className="text-lg font-semibold">Letra</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A letra vem do LRCLIB, um banco aberto de letras. Ajuste o nome da música e do artista se a busca não encontrar.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Música</span>
          <input aria-label="Música" value={qTitle} onChange={(e) => setQTitle(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Artista</span>
          <input aria-label="Artista" value={qArtist} onChange={(e) => setQArtist(e.target.value)} className={field} />
        </label>
      </div>
      <Button className="mt-3" onClick={() => void run()} disabled={busy || !qTitle.trim()}>
        <Search className="size-4" /> {busy ? 'Buscando…' : 'Buscar letra'}
      </Button>

      {results && results.length === 0 && <p className="mt-4 text-sm">Nenhuma letra encontrada. Tente outro nome ou cole a letra abaixo.</p>}
      {results && results.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {results.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0">
                <span className="block font-semibold">{r.trackName}</span>
                <span className="block text-sm text-muted-foreground">
                  <span>{r.artistName}</span> · {clock(r.duration)} · {r.syncedLyrics ? 'sincronizada' : 'só texto'}
                  {Math.abs(r.duration - durationSec) > 5 && durationSec > 0 ? ' · duração diferente do áudio' : ''}
                </span>
              </span>
              <Button variant="outline" onClick={() => choose(r)}>
                Usar esta letra
              </Button>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-6 block">
        <span className="text-sm font-semibold">Colar a letra</span>
        <textarea
          aria-label="Colar a letra"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder="Uma linha da música por linha"
          className="mt-1 w-full rounded-lg border border-border bg-surface p-3 outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </label>
      <Button
        variant="outline"
        className="mt-2"
        disabled={!pasted.trim()}
        onClick={() => onApply({ source: 'manual', lines: distributePlainLyrics(pasted, durationSec) })}
      >
        Usar a letra colada
      </Button>
    </div>
  );
};
