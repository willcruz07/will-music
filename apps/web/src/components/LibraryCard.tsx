import { ArrowUpRight, AudioLines, FileText, Music4, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export const LibraryCard = ({ kind, title, artist, to, description, metadata, badges, onDelete, deleting, deleteLabel }: {
  kind: 'studio' | 'chart' | 'score'; title: string; artist: string; to: string;
  description: string; metadata?: ReactNode; badges?: ReactNode;
  onDelete: () => void; deleting?: boolean; deleteLabel: string;
}) => {
  const Icon = kind === 'studio' ? AudioLines : kind === 'chart' ? FileText : Music4;
  const label = kind === 'studio' ? 'Estúdio' : kind === 'chart' ? 'Cifra' : 'Partitura';
  return <li className={`library-card library-card-${kind}`}>
    <div className="flex items-center justify-between gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><span className="library-card-icon"><Icon className="size-5" aria-hidden /></span><span className="hidden sm:inline">{label}</span></span>
      <button type="button" aria-label={deleteLabel} disabled={deleting} onClick={onDelete} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"><Trash2 className="size-4" /></button>
    </div>
    <Link to={to} aria-label={`Abrir ${label.toLowerCase()} “${title}”`} className="flex min-w-0 flex-1 flex-col rounded-b-2xl px-3 pb-4 pt-2 focus-visible:outline-primary sm:px-4">
      <h2 className="line-clamp-2 min-h-12 break-words text-base font-semibold leading-6">{title}</h2>
      <p className="mt-1 truncate text-xs text-muted-foreground">{artist || 'Artista não informado'}</p>
      <p className="mt-3 line-clamp-2 min-h-10 break-words text-xs leading-5 text-muted-foreground">{description}</p>
      {badges && <div className="mt-3 flex flex-wrap gap-1.5">{badges}</div>}
      {metadata && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">{metadata}</div>}
      <span className="mt-auto flex items-center justify-between gap-2 pt-5 text-xs font-semibold text-chord">{kind === 'studio' ? 'Abrir no Estúdio' : kind === 'chart' ? 'Ler cifra' : 'Ver partituras'}<ArrowUpRight className="size-4 shrink-0" /></span>
    </Link>
  </li>;
};
export const LibraryBadge = ({ children }: { children: ReactNode }) => <span className="max-w-full rounded-md bg-surface-2 px-2 py-1 text-xs text-foreground">{children}</span>;
