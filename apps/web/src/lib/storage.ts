export const formatBytes = (n: number): string => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.round(n / 1e3)} KB`;
};

type StorageApi = { estimate?: () => Promise<{ usage?: number; quota?: number }>; persisted?: () => Promise<boolean>; persist?: () => Promise<boolean> };

const api = (): StorageApi | undefined => (navigator as Navigator & { storage?: StorageApi }).storage;

export const storageStatus = async (): Promise<{ usage?: number; quota?: number; persisted: boolean }> => {
  const s = api();
  if (!s) return { persisted: false };
  const [estimate, persisted] = await Promise.all([s.estimate?.().catch(() => ({})) ?? {}, s.persisted?.().catch(() => false) ?? false]);
  return { ...estimate, persisted };
};

/** Asks the browser not to evict this site's data (iOS clears little-used sites otherwise). */
export const requestPersistence = async (): Promise<boolean> => {
  try {
    return (await api()?.persist?.()) ?? false;
  } catch {
    return false;
  }
};

/** The browser refused to store more data for this site (also when the error crossed a worker as text). */
export const isQuotaError = (error: unknown): boolean =>
  (error instanceof DOMException && error.name === 'QuotaExceededError') || (error instanceof Error && (error.name === 'QuotaExceededError' || /quota/i.test(error.message)));

/** What to tell the user when the site's storage is full, with the browser's own numbers. */
export const explainQuota = (estimate: { usage?: number; quota?: number }): string => {
  const numbers = estimate.usage !== undefined && estimate.quota ? ` (usando ${formatBytes(estimate.usage)} de ${formatBytes(estimate.quota)} permitidos)` : '';
  return (
    `O navegador não deixou guardar mais dados do will-music${numbers}. ` +
    'Se estiver numa janela anônima ou no perfil de visitante, abra o app numa janela normal: lá o limite é bem menor. ' +
    'Se não, libere espaço apagando faixas de outras músicas ou modelos em Ajustes.'
  );
};

/** Throws the explanation above when clearly less than `needed` bytes are left for this site. */
export const ensureRoom = async (needed: number, storage: StorageApi | undefined = api()): Promise<void> => {
  const estimate = await storage?.estimate?.().catch(() => undefined);
  if (!estimate?.quota || estimate.usage === undefined) return; // unknown: let the browser decide
  if (estimate.quota - estimate.usage < needed) throw new Error(explainQuota(estimate));
};

export type { StorageApi };
