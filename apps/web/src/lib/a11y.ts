import type { KeyboardEvent } from 'react';

const KEYS: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

/**
 * Arrow keys (and Home/End) inside a radio group or a tab list: move to the next option and choose it,
 * as the ARIA patterns expect. Put it on the element with role="radiogroup" or role="tablist".
 */
export const rovingKeys = (e: KeyboardEvent<HTMLElement>): void => {
  const move = KEYS[e.key];
  if (!move) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"],[role="tab"]')].filter((el) => !(el as HTMLButtonElement).disabled);
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0 || !items.length) return;
  e.preventDefault();
  const next = items[move(index, items.length)]!;
  next.focus();
  next.click();
};
