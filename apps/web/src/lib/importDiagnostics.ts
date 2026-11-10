import { db, getAudioImportAttempts } from './db.ts';
import { hasPredictableQuota, storageStatus } from './storage.ts';
import Dexie from 'dexie';

type ProbeResult = { write: string; cleanup?: string };

const failure = (error: unknown): string => {
  if (!error || typeof error !== 'object') return String(error);
  const item = error as { name?: string; message?: string; inner?: { name?: string; message?: string } };
  return `${item.name ?? 'Error'}: ${item.message ?? ''}${item.inner ? `; inner=${item.inner.name}: ${item.inner.message ?? ''}` : ''}`;
};

/** Small, unique records only. Never clears site data, user records, models or audio. */
const probe = async (value: unknown): Promise<{ write: string; cleanup?: string }> => {
  const key = `wm-import-probe-${crypto.randomUUID()}`;
  let write = 'ok';
  try {
    // A separate committed write is needed: writing and deleting inside one transaction would test no growth.
    await db.settings.put({ key, value });
  } catch (error) { write = failure(error); }
  try {
    await db.settings.delete(key);
    return { write };
  } catch (error) { return { write, cleanup: failure(error) }; }
};

const connectionProbe = async (freshDatabase: boolean): Promise<ProbeResult> => {
  const key = `wm-import-probe-${crypto.randomUUID()}`;
  const connection = new Dexie(freshDatabase ? key : db.name);
  if (freshDatabase) connection.version(1).stores({ settings: 'key' });
  let write = 'ok';
  let cleanup: string | undefined;
  try {
    await connection.open();
    await connection.table('settings').put({ key, value: new ArrayBuffer(32 * 1024) });
  } catch (error) { write = failure(error); }
  finally {
    if (freshDatabase) {
      connection.close();
      try { await connection.delete(); } catch (error) { cleanup = failure(error); }
    } else {
      try { if (connection.isOpen()) await connection.table('settings').delete(key); } catch (error) { cleanup = failure(error); }
      connection.close();
    }
  }
  return { write, ...(cleanup ? { cleanup } : {}) };
};

const cacheProbe = async (): Promise<ProbeResult> => {
  if (typeof caches === 'undefined' || typeof caches.open !== 'function') return { write: 'unsupported' };
  const name = `wm-import-probe-${crypto.randomUUID()}`;
  let write = 'ok';
  try {
    const cache = await caches.open(name);
    await cache.put(new URL(`/__wm_diagnostic/${name}`, location.href).href, new Response(new Uint8Array(32 * 1024)));
  } catch (error) { write = failure(error); }
  try { await caches.delete(name); return { write }; }
  catch (error) { return { write, cleanup: failure(error) }; }
};

const opfsProbe = async (): Promise<ProbeResult> => {
  if (typeof navigator.storage?.getDirectory !== 'function') return { write: 'unsupported' };
  const name = `wm-import-probe-${crypto.randomUUID()}`;
  let root: FileSystemDirectoryHandle | undefined;
  let writer: FileSystemWritableFileStream | undefined;
  let write = 'ok';
  try {
    root = await navigator.storage.getDirectory();
    const file = await root.getFileHandle(name, { create: true });
    writer = await file.createWritable();
    await writer.write(new Uint8Array(32 * 1024));
    await writer.close();
    writer = undefined;
    if ((await file.getFile()).size !== 32 * 1024) throw new Error('O arquivo de teste não foi gravado por completo.');
  } catch (error) {
    write = failure(error);
    try { await writer?.abort(); } catch { /* Preserve the original write error. */ }
  }
  try { await root?.removeEntry(name); return { write }; }
  catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return { write };
    return { write, cleanup: failure(error) };
  }
};

/** User-triggered investigation after an import refusal; the report excludes file names and audio content. */
export const diagnoseAudioImport = async (error: unknown, file: { size: number; type: string }): Promise<string> => {
  const before = await storageStatus();
  const probes = {
    metadata: await probe('will-music storage check'),
    binary32KB: await probe(new ArrayBuffer(32 * 1024)),
    blob32KB: await probe(new Blob([new Uint8Array(32 * 1024)], { type: 'application/octet-stream' })),
    sameDatabaseNewConnection: await connectionProbe(false),
    separateDatabase: await connectionProbe(true),
    cacheStorage32KB: await cacheProbe(),
    opfs32KB: await opfsProbe(),
  };
  let cacheNames: string[] | string;
  try { cacheNames = await caches.keys(); } catch (error) { cacheNames = failure(error); }
  return JSON.stringify({
    version: 2,
    recordedAt: new Date().toISOString(),
    origin: location.origin,
    browser: navigator.userAgent,
    secureContext: globalThis.isSecureContext,
    standalone: typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
    file: { bytes: file.size, mimeType: file.type },
    failure: failure(error),
    attempts: getAudioImportAttempts(error),
    storageBefore: before,
    reportedQuotaIsPredictable: hasPredictableQuota(before),
    storageAfter: await storageStatus(),
    databaseOpen: db.isOpen(),
    memory: (() => {
      const memory = (performance as Performance & { memory?: { jsHeapSizeLimit: number; totalJSHeapSize: number; usedJSHeapSize: number } }).memory;
      return memory ? { jsHeapSizeLimit: memory.jsHeapSizeLimit, totalJSHeapSize: memory.totalJSHeapSize, usedJSHeapSize: memory.usedJSHeapSize } : null;
    })(),
    probes,
    cacheNames,
  }, null, 2);
};
