import { parseChordPro } from './chart.ts';
import { db, now, type Song } from './db.ts';
import { firebaseConfig } from './cloud/config.ts';
import { isQuotaError } from './storage.ts';
import { validArtistPhoto } from './catalogPhotoUrl.ts';

export type CatalogArtist = { name: string; photo: string; slug: string; photoCandidates?: string[] };
export type CatalogChart = { id: string; title: string; artist: string; artistRef?: CatalogArtist; content: string; style: string; key?: string };
const text = (value: unknown) => typeof value === 'string' ? value : '';
const validKey = (value: string) => /^[A-G][#b]?m?$/u.test(value.trim()) ? value.trim() : undefined;
const project = import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
export const mapCatalogArtist = (data: Record<string, unknown>): CatalogArtist | null => {
  const raw = data.artist && typeof data.artist === 'object' ? data.artist as Record<string, unknown> : {};
  const name = text(raw.name) || text(data.artist);
  if (!name.trim()) return null;
  const candidates = [...new Set([raw.photo, raw.image, raw.photoURL].map(validArtistPhoto).filter(Boolean))];
  return { name, slug: text(raw.slug), photo: candidates[0] ?? '', ...(candidates.length > 1 ? { photoCandidates: candidates } : {}) };
};
export const catalogArtistId = (artist: CatalogArtist): string => artist.slug ? `slug:${artist.slug}` : `name:${artist.name}`;
export const catalogArtistSelector = (id: string): { field: 'artist.slug' | 'artist.name'; value: string } => {
  const slug = id.startsWith('slug:');
  const value = id.slice(5);
  if ((!slug && !id.startsWith('name:')) || !value.trim() || value.length > 500) throw new Error('Artista inválido.');
  return { field: slug ? 'artist.slug' : 'artist.name', value };
};
export const catalogArtistPath = (artist: CatalogArtist): string => `/catalogo/artista/${encodeURIComponent(catalogArtistId(artist))}`;

/** Alt7 annotations become visible comments; chord tokens stay at their original lyric positions. */
export const catalogContent = (content: string): string => content.replace(/\{([^{}]*)\}/gu, (raw, body: string) => {
  const directive = /^\s*(title|t|artist|a|key|k|capo|tempo|bpm|subtitle|st|comment|c)\s*:/iu.exec(body);
  if (directive) return `\n${raw}\n`;
  return `\n{comment: ${body.trim()}}\n`;
}).replace(/\n{3,}/gu, '\n\n').trim();

export const mapCatalogChart = (id: string, data: Record<string, unknown>): CatalogChart | null => {
  const artist = mapCatalogArtist(data);
  const title = text(data.title).trim();
  if (!title) return null;
  const content = catalogContent(text(data.content));
  const meta = parseChordPro(content).meta;
  return { id, title, artist: artist?.name || '', ...(artist ? { artistRef: artist } : {}), content, style: text(data.style), key: validKey(text(data.key)) ?? validKey(meta.key ?? meta.k ?? '') };
};

/** Stable identity prevents duplicate imports, including simultaneous saves in separate tabs. */
export const catalogLocalId = async (remoteId: string): Promise<string> => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${project}/cifras/${remoteId}`));
  return `catalog-${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
};
export const findSavedCatalogChart = async (id: string): Promise<Song | undefined> => db.songs.get(await catalogLocalId(id));

export const saveCatalogChart = async (item: CatalogChart, transpose = 0, fontSize = 16): Promise<Song> => {
  if (!item.content.trim()) throw new Error('Esta cifra ainda não tem conteúdo disponível para salvar.');
  const id = await catalogLocalId(item.id);
  return db.transaction('rw', db.songs, db.charts, async () => {
    const existing = await db.songs.get(id);
    if (existing) return existing; // Never overwrite the musician's local edits.
    const stamp = now();
    const song: Song = { id, title: item.title, artist: item.artist, key: item.key, durationSec: 0, favorite: false, analysisStatus: 'done', createdAt: stamp, updatedAt: stamp,
      catalogSource: { project, collection: 'cifras', id: item.id, savedAt: stamp } };
    await db.songs.add(song);
    await db.charts.add({ id: `${id}-chart`, songId: id, chordPro: item.content, transpose, fontSize, origin: 'manual', createdAt: stamp, updatedAt: stamp });
    return song;
  }).catch(error => {
    if (isQuotaError(error)) throw new Error('O navegador recusou o armazenamento da cifra. Verifique o espaço disponível e as permissões de armazenamento do site e tente novamente.', { cause: error });
    throw error;
  });
};
