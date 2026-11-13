import { Music2 } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { catalogArtistId, type CatalogArtist } from '../lib/catalogData.ts';
import { artistPhotoCandidates, artistPhotoVersion, rejectArtistPhoto, rememberArtistPhotos, subscribeArtistPhotos } from '../lib/catalogArtistPhotos.ts';

export const CatalogArtistPhoto = ({ artist, className = 'size-20' }: { artist: CatalogArtist; className?: string }) => {
  const version = useSyncExternalStore(subscribeArtistPhotos, artistPhotoVersion);
  const root = useRef<HTMLSpanElement>(null);
  const id = catalogArtistId(artist);
  const attempted = useRef<string | null>(null);
  const photo = artistPhotoCandidates(artist)[0];
  useEffect(() => { rememberArtistPhotos(artist); }, [id, artist.photo, artist.photoCandidates]);
  useEffect(() => {
    if (photo || attempted.current === id || !root.current) return;
    let active = true;
    const lookup = () => {
      if (!active || attempted.current === id) return;
      void import('../lib/cloud/catalog.ts').then(api => {
        if (active && attempted.current !== id) { attempted.current = id; return api.findCatalogArtistPhoto(artist); }
      })
        .catch(error => { if (active) console.warn('Foto alternativa do artista indisponível', error); });
    };
    if (typeof IntersectionObserver === 'undefined') lookup();
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); lookup(); }
    }, { rootMargin: '100px' });
    observer?.observe(root.current);
    return () => { active = false; observer?.disconnect(); };
  }, [id, photo, version]);
  return <span ref={root} className={`${className} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 text-chord`} aria-hidden>{photo ? <img key={photo} src={photo} alt="" referrerPolicy="no-referrer" loading="lazy" className="size-full object-cover" onError={() => rejectArtistPhoto(photo)} /> : <Music2 className="size-8" />}</span>;
};
