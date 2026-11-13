import { collection, documentId, endAt, getCountFromServer, getDocFromServer, getDocsFromServer, getFirestore, doc, limit, orderBy, query, startAfter, startAt, where, type QueryConstraint, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { cloudApp } from './firebase.ts';
import { catalogArtistId, catalogArtistSelector, mapCatalogArtist, mapCatalogChart, type CatalogArtist, type CatalogChart } from '../catalogData.ts';
import { artistPhotoCandidates, rememberArtistPhotos } from '../catalogArtistPhotos.ts';

export type CatalogPage = { items: CatalogChart[]; cursor: QueryDocumentSnapshot<DocumentData> | null; more: boolean };
export type CatalogField = 'title' | 'artist';
export type CatalogFilters = { letter?: string; style?: string; descending?: boolean };
const rangePrefix = (term: string, letter = ''): string | null => {
  if (!letter) return term.trim();
  if (!term.trim()) return letter;
  return term.trim().startsWith(letter) ? term.trim() : null;
};
const rangeConstraints = (prefix: string, descending: boolean, cursor?: unknown): QueryConstraint[] => {
  const constraints: QueryConstraint[] = [];
  if (cursor) constraints.push(startAfter(cursor));
  else if (prefix) constraints.push(startAt(descending ? `${prefix}\uf8ff` : prefix));
  if (prefix) constraints.push(endAt(descending ? prefix : `${prefix}\uf8ff`));
  return constraints;
};
const PAGE_SIZE = 24;
type Cached<T> = { value: T; until: number };
const pages = new Map<string, Cached<CatalogPage>>();
const documents = new Map<string, Cached<CatalogChart>>();
const pendingPages = new Map<string, Promise<CatalogPage>>();
export type ArtistPage = { items: CatalogArtist[]; cursor: string | null; more: boolean };
const artistPages = new Map<string, Cached<ArtistPage>>();
const artists = new Map<string, Cached<CatalogArtist>>();
const pendingArtists = new Map<string, Promise<ArtistPage>>();
const firestore = getFirestore(cloudApp); // Memory cache only; explicit local saves use the app's existing library.
const remember = <T,>(map: Map<string, Cached<T>>, key: string, value: T, size: number) => {
  map.delete(key); map.set(key, { value, until: Date.now() + 5 * 60 * 1000 });
  if (map.size > size) map.delete(map.keys().next().value!);
};
const rememberArtist = (artist: CatalogArtist): CatalogArtist => {
  rememberArtistPhotos(artist);
  const candidates = artistPhotoCandidates(artist);
  const enriched = { ...artist, photo: candidates[0] ?? '', ...(candidates.length > 1 ? { photoCandidates: candidates } : {}) };
  remember(artists, catalogArtistId(artist), enriched, 120);
  return enriched;
};
const deadline = async <T,>(request: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([request, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('A consulta demorou mais que o esperado. Verifique sua conexão e tente novamente.')), 20000); })]); }
  finally { clearTimeout(timer!); }
};
export const catalogError = (error: unknown): string => {
  // Preserve the SDK message, including Firebase's generated index-creation URL.
  console.error('Falha ao consultar o catálogo do Firebase', error);
  const code = (error as { code?: string })?.code?.replace('firestore/', '');
  if (code === 'permission-denied' || code === 'unauthenticated') return 'O servidor não autorizou esta consulta. Entre na sua conta e tente novamente; se continuar, as permissões do catálogo precisam ser verificadas.';
  if (code === 'failed-precondition') return 'Esta pesquisa precisa de um índice no Firebase. Isso não indica perda de login. O responsável pelo catálogo deve criar o índice indicado no console e aguardar sua ativação; depois, tente novamente.';
  if (code === 'unavailable' || !navigator.onLine) return 'Sem conexão com o catálogo. Suas cifras salvas continuam disponíveis na biblioteca.';
  return error instanceof Error ? error.message : 'Não foi possível consultar o catálogo agora. Tente novamente.';
};

export const listCatalog = async (field: CatalogField, term: string, cursor?: QueryDocumentSnapshot<DocumentData> | null, artist?: CatalogArtist, filters: CatalogFilters = {}): Promise<CatalogPage> => {
  const search = rangePrefix(term, filters.letter);
  if (search === null) return { items: [], cursor: null, more: false };
  const cacheKey = JSON.stringify([field, search, cursor?.id ?? '', artist ? catalogArtistId(artist) : '', filters]);
  const cached = pages.get(cacheKey);
  if (cached && (cached.until > Date.now() || !navigator.onLine)) return cached.value;
  const pending = pendingPages.get(cacheKey);
  if (pending) return pending;
  if (!navigator.onLine) throw new Error('Você está offline. Abra a aba Cifras para usar os itens já salvos.');
  const direction = filters.descending ? 'desc' : 'asc';
  const constraints: QueryConstraint[] = [orderBy(field === 'artist' ? 'artist.name' : 'title', direction), orderBy(documentId(), direction)];
  if (filters.style) constraints.unshift(where('style', '==', filters.style));
  if (artist) { const selected = catalogArtistSelector(catalogArtistId(artist)); constraints.unshift(where(selected.field, '==', selected.value)); }
  constraints.push(...rangeConstraints(search, !!filters.descending, cursor));
  constraints.push(limit(PAGE_SIZE));
  const request = (async () => {
    const snapshot = await deadline(getDocsFromServer(query(collection(firestore, 'cifras'), ...constraints)));
    const items = snapshot.docs.map(item => mapCatalogChart(item.id, item.data())).filter((item): item is CatalogChart => item !== null);
    for (const item of items) { remember(documents, item.id, item, 120); if (item.artistRef) rememberArtist(item.artistRef); }
    const page = { items, cursor: snapshot.docs.at(-1) ?? null, more: snapshot.size === PAGE_SIZE };
    remember(pages, cacheKey, page, 8);
    return page;
  })();
  pendingPages.set(cacheKey, request);
  try { return await request; }
  finally { pendingPages.delete(cacheKey); }
};

/** A bounded page of source documents, grouped locally; the next cursor skips the entire last name. */
const fetchCatalogArtists = async (term: string, cursor: string | null = null, filters: CatalogFilters = {}): Promise<ArtistPage> => {
  const search = rangePrefix(term, filters.letter);
  if (search === null) return { items: [], cursor: null, more: false };
  const key = JSON.stringify([search, cursor, filters]);
  const cached = artistPages.get(key);
  if (cached && (cached.until > Date.now() || !navigator.onLine)) return cached.value;
  if (!navigator.onLine) throw new Error('Conecte-se para procurar novos artistas.');
  const unique = new Map<string, CatalogArtist>();
  let next = cursor; let more = true;
  const started = Date.now();
  for (let round = 0; round < 24 && unique.size < PAGE_SIZE && more; round++) {
    if (round > 0 && Date.now() - started > 12000) break;
    const remaining = PAGE_SIZE - unique.size;
    const constraints: QueryConstraint[] = [orderBy('artist.name', filters.descending ? 'desc' : 'asc')];
    if (filters.style) constraints.unshift(where('style', '==', filters.style));
    constraints.push(...rangeConstraints(search, !!filters.descending, next), limit(remaining));
    const snapshot = await deadline(getDocsFromServer(query(collection(firestore, 'cifras'), ...constraints)));
    for (const source of snapshot.docs) {
      const artist = mapCatalogArtist(source.data());
      if (!artist) continue;
      const enriched = rememberArtist(artist);
      unique.set(catalogArtistId(artist), enriched);
    }
    const last = snapshot.docs.at(-1)?.data().artist;
    const lastName = last && typeof last === 'object' && typeof last.name === 'string' ? last.name : null;
    more = snapshot.size === remaining && lastName !== null && lastName !== next;
    if (lastName !== null) next = lastName;
  }
  const result = { items: [...unique.values()], cursor: next, more };
  remember(artistPages, key, result, 8);
  return result;
};
export const listCatalogArtists = async (term: string, cursor: string | null = null, filters: CatalogFilters = {}): Promise<ArtistPage> => {
  const key = JSON.stringify([term.trim(), cursor, filters]);
  const pending = pendingArtists.get(key);
  if (pending) return pending;
  const request = fetchCatalogArtists(term, cursor, filters);
  pendingArtists.set(key, request);
  try { return await request; } finally { pendingArtists.delete(key); }
};

const counts = new Map<string, Cached<number>>();
export const countCatalogArtist = async (artist: CatalogArtist, style = ''): Promise<number> => {
  const key = JSON.stringify([catalogArtistId(artist), style]);
  const cached = counts.get(key);
  if (cached && cached.until > Date.now()) return cached.value;
  const selected = catalogArtistSelector(catalogArtistId(artist));
  const constraints = [where(selected.field, '==', selected.value)];
  if (style) constraints.push(where('style', '==', style));
  const result = await deadline(getCountFromServer(query(collection(firestore, 'cifras'), ...constraints)));
  const count = result.data().count;
  remember(counts, key, count, 120);
  return count;
};

export type StylePage = { items: string[]; cursor: string | null; more: boolean };
const stylePages = new Map<string, Cached<StylePage>>();
/** Skip repeated values using field cursors; each discovery request reads one source document. */
export const listCatalogStyles = async (cursor: string | null = null): Promise<StylePage> => {
  const cached = stylePages.get(cursor ?? '');
  if (cached && cached.until > Date.now()) return cached.value;
  const items: string[] = []; let next = cursor; let more = false;
  for (let i = 0; i < 12; i++) {
    const constraints: QueryConstraint[] = [orderBy('style'), limit(1)];
    if (next !== null) constraints.push(startAfter(next));
    const snapshot = await deadline(getDocsFromServer(query(collection(firestore, 'cifras'), ...constraints)));
    const value = snapshot.docs[0]?.data().style;
    if (typeof value !== 'string' || value === next) { more = false; break; }
    next = value; more = true;
    if (value.trim()) items.push(value);
  }
  const result = { items, cursor: next, more };
  remember(stylePages, cursor ?? '', result, 16);
  return result;
};

export const getCatalogArtist = async (id: string): Promise<CatalogArtist> => {
  const cached = artists.get(id);
  if (cached && (cached.until > Date.now() || !navigator.onLine)) return cached.value;
  if (!navigator.onLine) throw new Error('Conecte-se para abrir este artista no catálogo.');
  const selected = catalogArtistSelector(id);
  const snapshot = await deadline(getDocsFromServer(query(collection(firestore, 'cifras'), where(selected.field, '==', selected.value), limit(1))));
  const artist = snapshot.docs[0] ? mapCatalogArtist(snapshot.docs[0].data()) : null;
  if (!artist) throw new Error('Este artista não está disponível no catálogo.');
  return rememberArtist(artist);
};
export const getCatalogChart = async (id: string): Promise<CatalogChart> => {
  const cached = documents.get(id);
  if (cached && (cached.until > Date.now() || !navigator.onLine)) return cached.value;
  if (!id || id.includes('/')) throw new Error('Identificação da cifra inválida.');
  if (!navigator.onLine) throw new Error('Você está offline. Abra as cifras já salvas na sua biblioteca.');
  const snapshot = await deadline(getDocFromServer(doc(firestore, 'cifras', id)));
  const item = snapshot.exists() ? mapCatalogChart(snapshot.id, snapshot.data()) : null;
  if (!item) throw new Error('Esta cifra não está mais disponível no catálogo.');
  if (item.artistRef) rememberArtist(item.artistRef);
  remember(documents, id, item, 120);
  return item;
};

const pendingPhotos = new Map<string, Promise<void>>();
const photoLookups = new Map<string, number>();
let activePhotoLookups = 0;
const photoQueue: (() => void)[] = [];
const acquirePhotoSlot = async () => {
  if (activePhotoLookups < 3) { activePhotoLookups++; return; }
  await new Promise<void>(resolve => photoQueue.push(resolve));
};
const releasePhotoSlot = () => { const next = photoQueue.shift(); if (next) next(); else activePhotoLookups--; };
/** Runs only for visible avatars without a usable image; each alias returns at most four candidates. */
export const findCatalogArtistPhoto = async (artist: CatalogArtist): Promise<void> => {
  const id = catalogArtistId(artist);
  if (!navigator.onLine || artistPhotoCandidates(artist).length) return;
  const pending = pendingPhotos.get(id);
  if (pending) return pending;
  if ((photoLookups.get(id) ?? 0) > Date.now()) return;
  photoLookups.delete(id); photoLookups.set(id, Date.now() + 5 * 60 * 1000);
  if (photoLookups.size > 240) photoLookups.delete(photoLookups.keys().next().value!);
  const request = (async () => {
    await acquirePhotoSlot();
    try {
    if (artistPhotoCandidates(artist).length) return;
    const selected = catalogArtistSelector(id);
    for (const field of ['artist.photo', 'artist.image', 'artist.photoURL']) {
      try {
        const snapshot = await deadline(getDocsFromServer(query(collection(firestore, 'cifras'),
          where(selected.field, '==', selected.value), where(field, '>=', 'https://'), where(field, '<=', 'https://\uf8ff'), orderBy(field), limit(4))));
        for (const source of snapshot.docs) {
          const candidate = mapCatalogArtist(source.data());
          if (candidate && (selected.field === 'artist.slug' ? candidate.slug === artist.slug : candidate.name === artist.name)) {
            rememberArtist(candidate);
            if (!artist.slug && candidate.slug) rememberArtist({ ...candidate, slug: '' });
          }
        }
        if (artistPhotoCandidates(artist).length) return;
      } catch (error) { console.warn('Não foi possível buscar outra foto do artista', { artistId: id, field, error }); }
    }
    } finally { releasePhotoSlot(); }
  })();
  pendingPhotos.set(id, request);
  try { await request; } finally { pendingPhotos.delete(id); }
};
