import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureRoom, explainQuota, hasPredictableQuota } from '../src/lib/storage.ts';

afterEach(() => vi.unstubAllGlobals());
const report = { usage: 330558947, quota: 11067977187 };
describe('Chromium predictable reported quota', () => {
  it('recognizes the exact usage + 10 GiB pattern in the user report', () => {
    vi.stubGlobal('navigator', { userAgent: 'Chrome/156.0.0.0' });
    expect(hasPredictableQuota(report)).toBe(true);
    expect(hasPredictableQuota({ usage: 330601712, quota: 11068019952 })).toBe(true);
    expect(hasPredictableQuota({ usage: 330e6, quota: 1e9 })).toBe(false);
    const explanation = explainQuota(report);
    expect(explanation).toContain('o navegador não informa o limite real');
    expect(explanation).not.toContain('11,1 GB');
    expect(explanation).not.toContain('permitidos');
  });

  it('does not claim this pattern for unrelated browsers or missing estimates', () => {
    vi.stubGlobal('navigator', { userAgent: 'Firefox/150' });
    expect(hasPredictableQuota(report)).toBe(false);
    expect(hasPredictableQuota({})).toBe(false);
  });

  it('does not use an artificial number to reject an operation before the browser checks it', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Chrome/156.0.0.0' });
    await expect(ensureRoom(20 * 1024 ** 3, { estimate: async () => report })).resolves.toBeUndefined();
    await expect(ensureRoom(100, { estimate: async () => ({ usage: 99, quota: 100 }) })).rejects.toThrow('recusou');
  });
});
