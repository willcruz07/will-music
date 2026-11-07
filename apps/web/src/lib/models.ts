import { MODELS, type ModelId } from '@will-music/engine';

const CACHE_NAME = 'wm-models-v1';

const toHex = (digest: ArrayBuffer): string =>
  Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');

const readWithProgress = async (response: Response, total: number, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array<ArrayBuffer>> => {
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  // One buffer of the pinned size, filled in place: a 285 MB model is never held twice.
  let out = new Uint8Array(total);
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (loaded + value.length > out.length) {
      const bigger = new Uint8Array(Math.max(out.length * 2, loaded + value.length));
      bigger.set(out.subarray(0, loaded));
      out = bigger;
    }
    out.set(value, loaded);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  return loaded === out.length ? out : out.slice(0, loaded);
};

/** Model bytes from Cache Storage, or downloaded from the pinned URL and verified by SHA-256 before caching. */
export const fetchModel = async (
  id: ModelId,
  onProgress?: (loaded: number, total: number) => void,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array<ArrayBuffer>> => {
  const model = MODELS[id];
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(model.url);
  if (cached) {
    const bytes = new Uint8Array(await cached.arrayBuffer());
    onProgress?.(bytes.length, bytes.length);
    return bytes;
  }
  let response: Response;
  try {
    response = await fetchFn(model.url);
  } catch {
    throw new Error(`Não foi possível baixar o modelo ${id}. Verifique a conexão e tente de novo.`);
  }
  if (!response.ok) throw new Error(`Não foi possível baixar o modelo ${id} (HTTP ${response.status}).`);
  const bytes = await readWithProgress(response, model.bytes, onProgress);
  const actual = toHex(await crypto.subtle.digest('SHA-256', bytes));
  if (actual !== model.sha256) throw new Error(`Modelo corrompido: ${id}. Tente de novo.`);
  try {
    await cache.put(model.url, new Response(bytes));
  } catch (error) {
    // Storage full (e.g. a private window): the verified model still works now, it is just downloaded again next time.
    console.warn(`Modelo ${id} não foi guardado no aparelho`, error);
  }
  return bytes;
};

export const listCachedModels = async (): Promise<{ id: ModelId; bytes: number }[]> => {
  const cache = await caches.open(CACHE_NAME);
  const urls = new Set((await cache.keys()).map((r) => r.url));
  const out: { id: ModelId; bytes: number }[] = [];
  for (const id of Object.keys(MODELS) as ModelId[]) {
    if (!urls.has(MODELS[id].url)) continue;
    // Cached files were verified by SHA-256 on the way in, so their size is the pinned one (no need to read 285 MB).
    out.push({ id, bytes: MODELS[id].bytes });
  }
  return out;
};

export const deleteCachedModels = async (): Promise<void> => {
  await caches.delete(CACHE_NAME);
};

export const deleteCachedModel = async (id: ModelId): Promise<void> => {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(MODELS[id].url);
};

/** Downloads every model not yet on the device (for using the app offline later), one at a time. */
export const downloadAllModels = async (onProgress: (done: number, total: number) => void, fetchFn: typeof fetch = fetch): Promise<void> => {
  const cache = await caches.open(CACHE_NAME);
  const missing: ModelId[] = [];
  for (const id of Object.keys(MODELS) as ModelId[]) if (!(await cache.match(MODELS[id].url))) missing.push(id);
  const total = missing.reduce((n, id) => n + MODELS[id].bytes, 0);
  let base = 0;
  for (const id of missing) {
    await fetchModel(id, (loaded) => onProgress(base + loaded, total), fetchFn);
    base += MODELS[id].bytes;
  }
  onProgress(total, total);
};
