import { useSyncExternalStore } from 'react';
let owners = 0;
const listeners = new Set<() => void>();
export const enterStudioLayout = () => {
  owners++; listeners.forEach(l => l());
  return () => { owners--; listeners.forEach(l => l()); };
};
export const useStudioLayout = () => useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => owners > 0);
