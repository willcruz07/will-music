import { Headphones, VolumeX } from 'lucide-react';
import type { MixTrack } from '../lib/mixer.ts';

export const TRACK_LABELS: Record<string, string> = {
  instrumental: 'Instrumental',
  lead: 'Voz principal',
  backing: 'Vocais de apoio',
  vocals: 'Voz',
  drums: 'Bateria',
  bass: 'Baixo',
  guitar: 'Violão / guitarra',
  piano: 'Piano / teclado',
  other: 'Outros',
};

export const Mixer = ({ tracks, onChange }: { tracks: MixTrack[]; onChange: (tracks: MixTrack[]) => void }) => {
  const set = (name: string, patch: Partial<MixTrack>) => onChange(tracks.map((t) => (t.name === name ? { ...t, ...patch } : t)));
  const anySolo = tracks.some((t) => t.solo);
  return (
    <ul className="space-y-1">
      {tracks.map((t) => {
        const label = TRACK_LABELS[t.name] ?? t.name;
        const silent = t.muted || (anySolo && !t.solo);
        return (
          <li key={t.name} className={`grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 ${silent ? 'opacity-50' : ''}`}>
            <span className="truncate text-sm font-semibold">{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(t.volume * 100)}
              aria-label={`Volume de ${label}`}
              onChange={(e) => set(t.name, { volume: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--primary)]"
            />
            <span className="flex gap-1">
              <button
                type="button"
                aria-pressed={t.muted}
                aria-label="Mudo"
                title={`Tirar ${label}`}
                onClick={() => set(t.name, { muted: !t.muted })}
                className={`inline-flex size-9 items-center justify-center rounded-lg ${t.muted ? 'bg-danger/15 text-danger' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <VolumeX className="size-4" />
              </button>
              <button
                type="button"
                aria-pressed={t.solo}
                aria-label="Solo"
                title={`Só ${label}`}
                onClick={() => set(t.name, { solo: !t.solo })}
                className={`inline-flex size-9 items-center justify-center rounded-lg ${t.solo ? 'bg-primary/15 text-chord' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <Headphones className="size-4" />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
};
