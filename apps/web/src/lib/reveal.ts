import { type RefObject, useEffect } from 'react';

/** Keeps the chosen option of a horizontally scrolling strip in view (on load and when it changes). */
export const useRevealSelected = (strip: RefObject<HTMLElement | null>, selected: unknown): void => {
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[aria-selected="true"],[aria-checked="true"],[aria-pressed="true"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [strip, selected]);
};
