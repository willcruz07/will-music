import type { ReactNode } from 'react';

/** A quiet, contextual empty state using the same surface as the library cards. */
export const LibraryEmptyState = ({ section, title, description, children }: {
  section: string; title: string; description: string; children?: ReactNode;
}) => <div className="my-5 rounded-2xl border border-dashed border-border bg-surface px-5 py-7 sm:px-7 sm:py-8">
  <div className="max-w-lg">
    <p className="text-xs font-semibold uppercase tracking-widest text-chord">{section}</p>
    <h2 className="mt-2 text-lg font-semibold tracking-tight">{title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
  </div>
</div>;
