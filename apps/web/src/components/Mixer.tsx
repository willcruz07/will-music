import type { MixTrack } from '../lib/mixer.ts';

export const TRACK_LABELS: Record<string, string> = { instrumental: 'Instrumental', lead: 'Voz principal', backing: 'Backing vocals' };

export const Mixer = ({ tracks, onChange }: { tracks: MixTrack[]; onChange: (tracks: MixTrack[]) => void }) => {
  const set = (name: string, patch: Partial<MixTrack>) => onChange(tracks.map((t) => (t.name === name ? { ...t, ...patch } : t)));
  return (
    <ul className="divide-y divide-border">
      {tracks.map((t) => {
        const label = TRACK_LABELS[t.name] ?? t.name;
        return (
          <li key={t.name} className="flex flex-wrap items-center gap-3 py-3">
            <span className="w-36 font-semibold">{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(t.volume * 100)}
              aria-label={`Volume de ${label}`}
              onChange={(e) => set(t.name, { volume: Number(e.target.value) / 100 })}
              className="w-40 accent-[var(--primary)]"
            />
            <button type="button" aria-pressed={t.muted} onClick={() => set(t.name, { muted: !t.muted })} className={`rounded-lg px-3 py-2 text-sm ${t.muted ? 'bg-muted font-semibold text-danger' : 'text-muted-foreground'}`}>
              Mudo
            </button>
            <button type="button" aria-pressed={t.solo} onClick={() => set(t.name, { solo: !t.solo })} className={`rounded-lg px-3 py-2 text-sm ${t.solo ? 'bg-muted font-semibold text-chord' : 'text-muted-foreground'}`}>
              Solo
            </button>
          </li>
        );
      })}
    </ul>
  );
};
