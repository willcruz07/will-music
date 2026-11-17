import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAccount } from '../lib/account.ts';
import type { CatalogChart } from '../lib/catalogData.ts';
import { itemLabel, MAIN_KEY, MAX_COMMENT, ratingSummary, ratingsFor } from '../lib/communityCatalog.ts';
import { useOnline } from '../lib/online.ts';
import { Button } from '../ui/Button.tsx';
import { CatalogAvatar, Stars } from './CatalogOptions.tsx';

/** Ratings of the selected version (main chart or option) and the musician's own stars and short comment. */
export const CatalogReviews = ({ chart, itemKey, onChange }: { chart: CatalogChart; itemKey: string; onChange: (chart: CatalogChart) => void }) => {
  const { user } = useAccount();
  const online = useOnline();
  const entries = ratingsFor(chart.ratings, itemKey);
  const { average, count } = ratingSummary(entries);
  const own = user ? chart.ratings[user.uid]?.items[itemKey] : undefined;
  const option = chart.options.find(o => o.key === itemKey);
  const isMine = !!user && (option ? option.author.uid === user.uid : itemKey === MAIN_KEY && chart.author?.uid === user.uid);
  const [stars, setStars] = useState(own?.stars ?? 0);
  const [comment, setComment] = useState(own?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => { setStars(own?.stars ?? 0); setComment(own?.comment ?? ''); setError(null); setDone(false); }, [itemKey, own?.stars, own?.comment]);

  const submit = () => {
    if (!stars || busy) return;
    setBusy(true); setError(null); setDone(false);
    void import('../lib/cloud/catalog.ts')
      .then(api => api.rateCatalogItem(chart, itemKey, stars, comment).catch(e => { throw new Error((e as { code?: string })?.code ? api.catalogError(e) : e instanceof Error ? e.message : 'Não foi possível avaliar.'); }))
      .then(next => { onChange(next); setDone(true); })
      .catch(e => setError(e instanceof Error ? e.message : 'Não foi possível avaliar.'))
      .finally(() => setBusy(false));
  };

  return (
    <section aria-label="Avaliações" className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="flex flex-wrap items-center gap-2 font-semibold">Avaliações · {itemLabel(chart.options, itemKey)}<span className="flex items-center gap-1 text-sm font-normal text-muted-foreground"><Stars value={average} />{count ? `${average.toFixed(1)} de 5 (${count})` : 'ainda sem avaliações'}</span></h2>

      {isMine ? <p className="mt-3 text-sm text-muted-foreground">Esta versão é sua. As avaliações vêm de outras pessoas.</p> : (
        <form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); submit(); }}>
          <div role="radiogroup" aria-label="Sua nota" className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`} onClick={() => setStars(n)} className="grid size-10 place-items-center rounded-lg hover:bg-muted">
                <Star className={`size-6 ${stars >= n ? 'fill-current text-chord' : 'text-muted-foreground'}`} />
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value.slice(0, MAX_COMMENT))} rows={2} placeholder="Comentário opcional sobre esta versão" aria-label="Comentário" className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!stars || busy || !online}>{busy ? 'Enviando…' : own ? 'Atualizar avaliação' : 'Avaliar'}</Button>
            <span className="text-xs text-muted-foreground">{comment.length}/{MAX_COMMENT}</span>
            {!online && <span className="text-xs text-muted-foreground">Conecte-se para avaliar.</span>}
            {done && <span role="status" className="text-xs text-chord">Avaliação salva.</span>}
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </form>
      )}

      {entries.length > 0 && (
        <ul className="mt-4 space-y-3">
          {entries.map(entry => (
            <li key={entry.uid} className="flex gap-2 border-t border-border pt-3 text-sm">
              <CatalogAvatar name={entry.name} photo={entry.photo} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2"><span className="font-semibold">{entry.name}</span><Stars value={entry.stars} /></p>
                {entry.comment && <p className="mt-0.5 break-words text-muted-foreground">{entry.comment}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
