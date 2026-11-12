import { Music2 } from 'lucide-react';
import { useState } from 'react';
import type { CatalogArtist } from '../lib/catalogData.ts';

export const CatalogArtistPhoto = ({ artist, className = 'size-20' }: { artist: CatalogArtist; className?: string }) => {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = /^https:\/\//iu.test(artist.photo) && artist.photo !== failed ? artist.photo : null;
  return <span className={`${className} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-chord`} aria-hidden>{photo ? <img src={photo} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" onError={() => setFailed(photo)} /> : <Music2 className="size-8" />}</span>;
};
