import { useEffect, useState } from 'react';
import { type Song, db } from '../lib/db.ts';
import { Button } from '../ui/Button.tsx';
import { SheetSelect } from '../ui/SheetSelect.tsx';

export type SongInfo = { title: string; artist: string; capo?: number; tempo?: number; timeSignature?: string; folder?: string };

const field = 'mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary';

export const SongInfoForm = ({ song, onSave }: { song: Song; onSave: (info: SongInfo) => void }) => {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [capo, setCapo] = useState(song.capo ?? 0);
  const [tempo, setTempo] = useState(song.tempo ? String(song.tempo) : '');
  const [timeSignature, setTimeSignature] = useState(song.timeSignature ?? '');
  const [folder, setFolder] = useState(song.folder ?? '');
  const [folders, setFolders] = useState<string[]>([]);
  useEffect(() => {
    void db.songs.toArray().then((all) => setFolders([...new Set(all.map((s) => s.folder).filter((f): f is string => !!f))].sort()));
  }, []);

  return (
    <form
      className="mt-6 grid max-w-2xl gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({
          title: title.trim(),
          artist: artist.trim(),
          capo: capo || undefined,
          tempo: tempo ? Number(tempo) : undefined,
          timeSignature: timeSignature || undefined,
          folder: folder.trim() || undefined,
        });
      }}
    >
      <h2 className="text-lg font-semibold sm:col-span-2">Dados da música</h2>
      <label className="block">
        <span className="text-sm font-semibold">Música</span>
        <input aria-label="Música" value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Artista</span>
        <input aria-label="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} className={field} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Capotraste</span>
        <SheetSelect
          label="Capotraste"
          value={String(capo)}
          onChange={(v) => setCapo(Number(v))}
          className="mt-1 h-11 w-full"
          options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: i === 0 ? 'Sem capotraste' : `Casa ${i}` }))}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Andamento (BPM)</span>
        <input aria-label="Andamento (BPM)" inputMode="numeric" value={tempo} onChange={(e) => setTempo(e.target.value.replace(/\D/gu, ''))} className={field} />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Compasso</span>
        <SheetSelect
          label="Compasso"
          value={timeSignature}
          onChange={setTimeSignature}
          className="mt-1 h-11 w-full"
          options={[{ value: '', label: 'Não informado' }, ...['4/4', '3/4', '2/4', '6/8', '12/8'].map((t) => ({ value: t, label: t }))]}
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Pasta</span>
        <input aria-label="Pasta" list="wm-folders" value={folder} placeholder="Ex.: Culto, Natal, Ensaio" onChange={(e) => setFolder(e.target.value)} className={field} />
        <datalist id="wm-folders">
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </label>
      <div className="flex items-end">
        <Button type="submit">Salvar dados</Button>
      </div>
    </form>
  );
};
