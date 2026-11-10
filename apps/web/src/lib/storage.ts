export const formatBytes = (n: number): string => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.round(n / 1e3)} KB`;
};

type StorageApi = { estimate?: () => Promise<{ usage?: number; quota?: number }>; persisted?: () => Promise<boolean>; persist?: () => Promise<boolean> };

/** Chromium can report usage + exactly 10 GiB for privacy, independently of the enforced limit. */
export const hasPredictableQuota = (estimate: { usage?: number; quota?: number }): boolean =>
  typeof navigator !== 'undefined' && /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent) &&
  estimate.usage !== undefined && estimate.quota !== undefined &&
  estimate.quota - estimate.usage === 10 * 1024 ** 3;

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
export const isQuotaError = (error: unknown): boolean => {
  const seen = new Set<object>();
  const pending: unknown[] = [error];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const detail = value as { name?: unknown; message?: unknown; inner?: unknown; cause?: unknown };
    if (detail.name === 'QuotaExceededError' || (typeof detail.message === 'string' && /QuotaExceededError|quota exceeded/i.test(detail.message))) return true;
    pending.push(detail.inner, detail.cause);
  }
  return false;
};

/** What to tell the user when the site's storage is full, with the browser's own numbers. */
export const explainQuota = (estimate: { usage?: number; quota?: number }): string => {
  const numbers = hasPredictableQuota(estimate)
    ? ` (uso estimado: ${formatBytes(estimate.usage!)}; o navegador não informa o limite real disponível)`
    : estimate.usage !== undefined && estimate.quota ? ` (usando ${formatBytes(estimate.usage)}; cota estimada: ${formatBytes(estimate.quota)})` : '';
  return (
    `O navegador recusou a gravação dos dados do will-music${numbers}. ` +
    'A cota informada é uma estimativa e não garante espaço disponível para esta gravação. ' +
    'Verifique o espaço livre no dispositivo e se o navegador permite armazenar dados deste site. ' +
    'Se estiver em janela anônima ou perfil de visitante, tente uma janela normal. ' +
    'Se o armazenamento do site estiver próximo do limite, libere espaço em Ajustes.'
  );
};

/** Throws the explanation above when clearly less than `needed` bytes are left for this site. */
export const ensureRoom = async (needed: number, storage: StorageApi | undefined = api()): Promise<void> => {
  const estimate = await storage?.estimate?.().catch(() => undefined);
  if (!estimate?.quota || estimate.usage === undefined || hasPredictableQuota(estimate)) return; // unknown: let the browser decide
  if (estimate.quota - estimate.usage < needed) throw new Error(explainQuota(estimate));
};

export type { StorageApi };
