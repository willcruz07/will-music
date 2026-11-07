import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// fake-indexeddb clones values with structuredClone, which turns jsdom Blobs into empty objects.
// Real browsers store Blobs in IndexedDB, so keep Blob instances by reference in tests.
const nativeClone = globalThis.structuredClone;
const clone = (value: unknown): unknown => {
  if (value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
  }
  return nativeClone(value);
};
globalThis.structuredClone = clone as typeof structuredClone;

// @ts-expect-error -- package exports hide the bundled types
await import('fake-indexeddb/auto');

afterEach(() => cleanup());
