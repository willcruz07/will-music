export const normalizeLoop = (a: number | null, b: number | null, duration: number): { a: number; b: number } | null => {
  if (a === null || b === null || !(duration > 0)) return null;
  const lo = Math.max(0, Math.min(a, b));
  const hi = Math.min(duration, Math.max(a, b));
  return hi - lo >= 1 ? { a: lo, b: hi } : null;
};
