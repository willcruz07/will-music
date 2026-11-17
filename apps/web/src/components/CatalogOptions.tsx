import { Star } from 'lucide-react';
import type { CatalogChart } from '../lib/catalogData.ts';
import { highlightKey, itemLabel, MAIN_KEY, ratingSummary, ratingsFor } from '../lib/communityCatalog.ts';

export const Stars = ({ value, size = 'size-3.5' }: { value: number; size?: string }) => (
  <span className="inline-flex items-center gap-0.5" aria-hidden>
    {[1, 2, 3, 4, 5].map(n => <Star key={n} className={`${size} ${value >= n - 0.25 ? 'fill-current text-chord' : 'text-muted-foreground/50'}`} />)}
  </span>
);

const Avatar = ({ name, photo }: { name: string; photo: string }) => photo
  ? <img src={photo} alt="" referrerPolicy="no-referrer" className="size-6 shrink-0 rounded-full object-cover" />
  : <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-chord">{name.slice(0, 1).toUpperCase()}</span>;
export { Avatar as CatalogAvatar };

/** "Principal" and every community option of a catalog chart, with author and average stars. */
export const CatalogOptions = ({ chart, selected, onSelect }: { chart: CatalogChart; selected: string; onSelect: (key: string) => void }) => {
  if (!chart.options.length) return null;
  const best = highlightKey(chart);
  const items = [
    { key: MAIN_KEY, name: chart.author?.name ?? chart.artist ?? 'Catálogo', photo: chart.author?.photo ?? chart.artistRef?.photo ?? '' },
    ...chart.options.map(o => ({ key: o.key, name: o.author.name, photo: o.author.photo })),
  ];
  return (
    <div role="radiogroup" aria-label="Versões da cifra" className="mt-4 flex gap-2 overflow-x-auto pb-1">
      {items.map(item => {
        const { average, count } = ratingSummary(ratingsFor(chart.ratings, item.key));
        const active = item.key === selected;
        return (
          <button key={item.key} type="button" role="radio" aria-checked={active} onClick={() => onSelect(item.key)}
            className={`min-w-40 shrink-0 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${active ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-muted'}`}>
            <span className="flex items-center gap-1.5 font-semibold">{itemLabel(chart.options, item.key)}{item.key === best && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary-foreground">Destaque</span>}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Avatar name={item.name} photo={item.photo} /><span className="truncate">{item.name}</span></span>
            <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Stars value={average} />{count ? `${average.toFixed(1)} (${count})` : 'Sem avaliações'}</span>
          </button>
        );
      })}
    </div>
  );
};
