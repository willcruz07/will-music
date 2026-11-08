import { MODELS, type ModelId } from '@will-music/engine';
import { createSha256 } from './sha256.ts';

const CACHE_NAME = 'wm-models-v1';

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

const download = async (id: ModelId, fetchFn: typeof fetch): Promise<Response> => {
  let response: Response;
  try {
    response = await fetchFn(MODELS[id].url);
  } catch {
    throw new Error(`Não foi possível baixar o modelo ${id}. Verifique a conexão e tente de novo.`);
  }
  if (!response.ok) throw new Error(`Não foi possível baixar o modelo ${id} (HTTP ${response.status}).`);
  return response;
};

const corrupted = (id: ModelId) => new Error(`Modelo corrompido: ${id}. Tente de novo.`);

/**
 * Downloads a model straight into Cache Storage, hashing it chunk by chunk on the way: memory stays at a few
 * chunks instead of the whole file (a 235 MB model held, hashed and copied whole used to kill the page on iPad).
 * A model whose SHA-256 does not match is removed again. Returns the bytes only when the cache refused to store
 * them (storage full, private window), from an in-memory fallback download.
 */
export const cacheModel = async (
  id: ModelId,
  onProgress?: (loaded: number, total: number) => void,
  fetchFn: typeof fetch = fetch,
): Promise<Uint8Array<ArrayBuffer> | null> => {
  const model = MODELS[id];
  const cache = await caches.open(CACHE_NAME);
  const response = await download(id, fetchFn);
  const hash = createSha256();
  if (response.body) {
    const reader = response.body.getReader();
    let loaded = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        hash.update(value);
        loaded += value.length;
        onProgress?.(loaded, model.bytes);
        controller.enqueue(value);
      },
      cancel(reason) {
        void reader.cancel(reason);
      },
    });
    let stored = true;
    try {
      await cache.put(model.url, new Response(stream));
    } catch (error) {
      console.warn(`Modelo ${id} não foi guardado no aparelho`, error);
      stored = false;
    }
    if (stored) {
      if (hash.hex() !== model.sha256) {
        await cache.delete(model.url);
        throw corrupted(id);
      }
      return null;
    }
  }
  // The cache refused the model: download it again into memory so it still works now (it is fetched again next time).
  const bytes = await readWithProgress(response.bodyUsed ? await download(id, fetchFn) : response, model.bytes, onProgress);
  const check = createSha256();
  check.update(bytes);
  if (check.hex() !== model.sha256) throw corrupted(id);
  return bytes;
};

/** Model bytes from Cache Storage, or downloaded (streamed into the cache, verified by SHA-256) first. */
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
  const kept = await cacheModel(id, onProgress, fetchFn);
  if (kept) return kept;
  const stored = await cache.match(model.url);
  if (!stored) throw new Error(`O modelo ${id} não ficou guardado no aparelho. Tente de novo.`);
  return new Uint8Array(await stored.arrayBuffer());
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

/** The models the first actions need: chords and key, the basic voice/instrumental separation, the notes of a score. */
export const BASIC_MODELS: ModelId[] = ['chordnet', 'cqtPlan', 'skey', 'kara2Core', 'kara2Data', 'basicPitch'];

/** Which of `ids` are not on the device yet. */
export const missingModels = async (ids: ModelId[] = BASIC_MODELS): Promise<ModelId[]> => {
  const cache = await caches.open(CACHE_NAME);
  const missing: ModelId[] = [];
  for (const id of ids) if (!(await cache.match(MODELS[id].url))) missing.push(id);
  return missing;
};

/** Downloads every model not yet on the device (for using the app offline later), one at a time. */
export const downloadAllModels = (onProgress: (done: number, total: number) => void, fetchFn: typeof fetch = fetch): Promise<void> =>
  downloadModels(Object.keys(MODELS) as ModelId[], onProgress, fetchFn);

/** Downloads the given models that are missing, one at a time, reporting overall progress. */
export const downloadModels = async (ids: ModelId[], onProgress: (done: number, total: number) => void, fetchFn: typeof fetch = fetch): Promise<void> => {
  const missing = await missingModels(ids);
  const total = missing.reduce((n, id) => n + MODELS[id].bytes, 0);
  let base = 0;
  for (const id of missing) {
    // Straight into the cache: nothing is read back, so the page never holds a whole model in memory.
    await cacheModel(id, (loaded) => onProgress(base + loaded, total), fetchFn);
    base += MODELS[id].bytes;
  }
  onProgress(total, total);
};
