import { collection, documentId, endAt, getDocFromServer, getDocsFromServer, getFirestore, doc, limit, orderBy, query, startAfter, startAt, where, type QueryConstraint, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { cloudApp } from './firebase.ts';
import { catalogArtistId, catalogArtistSelector, mapCatalogArtist, mapCatalogChart, type CatalogArtist, type CatalogChart } from '../catalogData.ts';

export type CatalogPage = { items: CatalogChart[]; cursor: QueryDocumentSnapshot<DocumentData> | null; more: boolean };
export type CatalogField = 'title' | 'artist';
const PAGE_SIZE = 24;
type Cached<T> = { value: T; until: number };
const pages = new Map<string, Cached<CatalogPage>>();
const documents = new Map<string, Cached<CatalogChart>>();
const pendingPages = new Map<string, Promise<CatalogPage>>();
export type ArtistPage = { items: CatalogArtist[]; cursor: string | null; more: boolean };
const artistPages = new Map<string, Cached<ArtistPage>>();
const artists = new Map<string, Cached<CatalogArtist>>();
const firestore = getFirestore(cloudApp); // Memory cache only; explicit local saves use the app's existing library.
const remember = <T,>(map: Map<string, Cached<T>>, key: string, value: T, size: number) => {
  map.delete(key); map.set(key, { value, until: Date.now() + 5 * 60 * 1000 });
  if (map.size > size) map.delete(map.keys().next().value!);
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

export const listCatalog = async (field: CatalogField, term: string, cursor?: QueryDocumentSnapshot<DocumentData> | null, artist?: CatalogArtist): Promise<CatalogPage> => {
  const search = term.trim();
  const cacheKey = JSON.stringify([field, search, cursor?.id ?? '', artist ? catalogArtistId(artist) : '']);
  const cached = pages.get(cacheKey);
  if (cached && (cached.until > Date.now() || !navigator.onLine)) return cached.value;
  const pending = pendingPages.get(cacheKey);
  if (pending) return pending;
  if (!navigator.onLine) throw new Error('Você está offline. Abra a aba Cifras para usar os itens já salvos.');
  const constraints: QueryConstraint[] = [orderBy(field === 'artist' ? 'artist.name' : 'title'), orderBy(documentId())];
  if (artist) { const selected = catalogArtistSelector(catalogArtistId(artist)); constraints.unshift(where(selected.field, '==', selected.value)); }
  if (cursor) constraints.push(startAfter(cursor));
  else if (search) constraints.push(startAt(search));
  if (search) constraints.push(endAt(`${search}\uf8ff`));
  constraints.push(limit(PAGE_SIZE));
  const request = (async () => {
    const snapshot = await deadline(getDocsFromServer(query(collection(firestore, 'cifras'), ...constraints)));
    const items = snapshot.docs.map(item => mapCatalogChart(item.id, item.data())).filter((item): item is CatalogChart => item !== null);
    for (const item of items) { remember(documents, item.id, item, 120); if (item.artistRef) remember(artists, catalogArtistId(item.artistRef), item.artistRef, 120); }
    const page = { items, cursor: snapshot.docs.at(-1) ?? null, more: snapshot.size === PAGE_SIZE };
    remember(pages, cacheKey, page, 8);
    return page;
  })();
  pendingPages.set(cacheKey, request);
  try { return await request; }
  finally { pendingPages.delete(cacheKey); }
};

/** A bounded page of source documents, grouped locally; the next cursor skips the entire last name. */
export const listCatalogArtists = async (term: string, cursor: string | null = null): Promise<ArtistPage> => {
  const search = term.trim(); const key = JSON.stringify([search, cursor]);
  const cached = artistPages.get(key);
  if (cached && (cached.until > Date.now() || !navigator.onLine)) return cached.value;
  if (!navigator.onLine) throw new Error('Conecte-se para procurar novos artistas.');
  const constraints: QueryConstraint[] = [orderBy('artist.name')];
  if (cursor !== null) constraints.push(startAfter(cursor)); else if (search) constraints.push(startAt(search));
  if (search) constraints.push(endAt(`${search}\uf8ff`));
  constraints.push(limit(PAGE_SIZE));
  const snapshot = await deadline(getDocsFromServer(query(collection(firestore, 'cifras'), ...constraints)));
  const unique = new Map<string, CatalogArtist>();
  for (const source of snapshot.docs) {
    const artist = mapCatalogArtist(source.data());
    if (!artist) continue;
    const id = catalogArtistId(artist); const previous = unique.get(id);
    if (!previous || (!previous.photo && artist.photo)) unique.set(id, artist);
  }
  for (const artist of unique.values()) remember(artists, catalogArtistId(artist), artist, 120);
  const last = snapshot.docs.at(-1)?.data().artist;
  const lastName = last && typeof last === 'object' && typeof last.name === 'string' ? last.name : null;
  const result = { items: [...unique.values()], cursor: lastName, more: snapshot.size === PAGE_SIZE && lastName !== null };
  remember(artistPages, key, result, 8);
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
  remember(artists, id, artist, 120);
  return artist;
};
export const getCatalogChart = async (id: string): Promise<CatalogChart> => {
  const cached = documents.get(id);
  if (cached && (cached.until > Date.now() || !navigator.onLine)) return cached.value;
  if (!id || id.includes('/')) throw new Error('Identificação da cifra inválida.');
  if (!navigator.onLine) throw new Error('Você está offline. Abra as cifras já salvas na sua biblioteca.');
  const snapshot = await deadline(getDocFromServer(doc(firestore, 'cifras', id)));
  const item = snapshot.exists() ? mapCatalogChart(snapshot.id, snapshot.data()) : null;
  if (!item) throw new Error('Esta cifra não está mais disponível no catálogo.');
  remember(documents, id, item, 120);
  return item;
};
