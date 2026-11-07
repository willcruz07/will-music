/** Tap-along timing: each mark() stamps the next lyric line; back() undoes the last mark. */
export const createSyncSession = (lineCount: number, start: readonly (number | null)[]) => {
  const original = Array.from({ length: lineCount }, (_, i) => start[i] ?? null);
  const times = [...original];
  let next = 0;
  return {
    get next() {
      return next;
    },
    get times() {
      return [...times];
    },
    get done() {
      return next >= lineCount;
    },
    mark(t: number) {
      if (next >= lineCount) return;
      times[next] = Math.round(t * 100) / 100;
      next += 1;
    },
    back() {
      if (next === 0) return;
      next -= 1;
      times[next] = original[next]!;
    },
  };
};
