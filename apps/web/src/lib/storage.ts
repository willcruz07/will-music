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
