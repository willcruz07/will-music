import { catalogArtistId, type CatalogArtist } from './catalogData.ts';
import { validArtistPhoto } from './catalogPhotoUrl.ts';

const photos = new Map<string, string[]>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => { version++; for (const listener of listeners) listener(); };
export const rememberArtistPhotos = (artist: CatalogArtist): void => {
  const id = catalogArtistId(artist);
  const previous = photos.get(id) ?? [];
  const next = [...new Set([...previous, artist.photo, ...(artist.photoCandidates ?? [])].map(validArtistPhoto).filter(url => !!url && !failed.has(url)))].slice(0, 8);
  if (next.length === previous.length && next.every((url, i) => url === previous[i])) return;
  photos.delete(id); photos.set(id, next);
  if (photos.size > 240) photos.delete(photos.keys().next().value!);
  notify();
};
export const artistPhotoCandidates = (artist: CatalogArtist): string[] => [...new Set([
  ...(photos.get(catalogArtistId(artist)) ?? []), artist.photo, ...(artist.photoCandidates ?? []),
].map(validArtistPhoto).filter(url => !!url && !failed.has(url)))];
export const rejectArtistPhoto = (url: string): void => {
  if (failed.has(url)) return;
  failed.add(url);
  if (failed.size > 500) failed.delete(failed.values().next().value!);
  notify();
};
export const subscribeArtistPhotos = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const artistPhotoVersion = () => version;
