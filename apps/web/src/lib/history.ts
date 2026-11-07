const GROUP_MS = 600;

/** Undo/redo stack where continuous typing (pauses under 600 ms) is one entry. */
export const createHistory = (initial: string) => {
  const past: string[] = [];
  const future: string[] = [];
  let value = initial;
  let lastSet = 0;
  return {
    get value() {
      return value;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    set(next: string) {
      if (next === value) return;
      const now = Date.now();
      if (past.length === 0 || now - lastSet > GROUP_MS) past.push(value);
      lastSet = now;
      future.length = 0;
      value = next;
    },
    undo() {
      const prev = past.pop();
      if (prev === undefined) return;
      future.push(value);
      value = prev;
      lastSet = 0;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return;
      past.push(value);
      value = next;
      lastSet = 0;
    },
  };
};
