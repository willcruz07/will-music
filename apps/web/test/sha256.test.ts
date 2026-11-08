import { describe, expect, it } from 'vitest';
import { createSha256 } from '../src/lib/sha256.ts';

const reference = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

describe('incremental SHA-256 (verifies a model while it streams to the cache)', () => {
  it.each([0, 1, 55, 56, 63, 64, 65, 1000, 100_003])('matches WebCrypto for %i bytes fed in uneven chunks', async (size) => {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) & 0xff;
    const h = createSha256();
    for (let i = 0, step = 1; i < size; i += step, step = (step * 7) % 997 + 1) h.update(bytes.subarray(i, Math.min(size, i + step)));
    expect(h.hex()).toBe(await reference(bytes));
  });
});
