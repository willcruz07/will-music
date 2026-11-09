import { FileAudio, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { createManualSong } from '../lib/chartEdit.ts';
import { createSong } from '../lib/db.ts';
import { readTags } from '../lib/metadata.ts';
import { explainQuota, isQuotaError } from '../lib/storage.ts';
import { Button } from '../ui/Button.tsx';

const minutes = (sec: number) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '');

export const NewSong = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);

  const choose = async (picked: File | undefined) => {
    if (!picked || submitting.current) return;
    setSaveError(null);
    setFile(picked);
    const tags = await readTags(picked);
    setTitle(tags.title);
    setArtist(tags.artist);
    setDuration(tags.durationSec);
  };

  const submit = async () => {
    if (!file || !title.trim() || submitting.current) return;
    submitting.current = true;
    setSaveError(null);
    setSaving(true);
    try {
      const song = await createSong({ title: title.trim(), artist: artist.trim(), durationSec: duration }, file);
      navigate(`/musica/${song.id}`);
    } catch (error) {
      console.error('Não foi possível salvar a música e o áudio no armazenamento local.', error);
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      setSaveError(
        isQuotaError(error)
          ? explainQuota({})
          : `Não foi possível salvar a música no aparelho. Tente novamente. Detalhe: ${detail}`,
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">Adicionar música</h1>
      <p className="mt-2 text-muted-foreground">O áudio fica só no seu aparelho. Nada é enviado para servidores.</p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void choose(e.dataTransfer.files[0]);
        }}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center ${dragging ? 'border-primary bg-muted' : 'border-border hover:bg-muted'}`}
      >
        {file ? <FileAudio className="size-8 text-primary" /> : <Upload className="size-8 text-primary" />}
        <span className="font-semibold">{file ? file.name : 'Escolha um arquivo de áudio ou arraste para cá'}</span>
        <span className="text-sm text-muted-foreground">{file ? minutes(duration) : 'MP3, WAV, M4A ou OGG'}</span>
        <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" className="sr-only" aria-label="Arquivo de áudio" disabled={saving} onChange={(e) => void choose(e.target.files?.[0])} />
      </label>

      {!file && (
        <p className="mt-6 text-sm text-muted-foreground">
          Não tem o áudio?{' '}
          <button
            type="button"
            className="font-semibold text-chord underline underline-offset-2"
            onClick={() => void createManualSong('Nova cifra', '').then((s) => navigate(`/musica/${s.id}/editar`))}
          >
            Criar uma cifra sem áudio
          </button>
        </p>
      )}

      {file && (
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Música</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Artista</span>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Ajuda a encontrar a letra" className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 outline-none placeholder:text-muted-foreground focus:border-primary" />
          </label>
          {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
          <Button onClick={() => void submit()} disabled={saving || !title.trim()} className="w-full sm:w-auto">
            {saving ? 'Salvando…' : 'Analisar música'}
          </Button>
        </div>
      )}
    </section>
  );
};
