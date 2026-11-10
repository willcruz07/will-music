import { Blob as NativeBlob } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/lib/db.ts';
import { diagnoseAudioImport } from '../src/lib/importDiagnostics.ts';
import Dexie from 'dexie';

beforeEach(async () => {
  vi.stubGlobal('Blob', NativeBlob);
  vi.stubGlobal('caches', { keys: async () => ['wm-models-v1'] });
  vi.stubGlobal('navigator', { userAgent: 'test-browser', storage: { estimate: async () => ({ usage: 331e6, quota: 11.1e9 }), persisted: async () => false } });
  await db.settings.clear();
  await db.settings.put({ key: 'user-setting', value: 'preserve' });
});
afterEach(() => vi.unstubAllGlobals());

describe('audio import diagnostics', () => {
  it('reports successful small writes, removes only its probes and excludes file names/audio', async () => {
    const file = { size: 9e6, type: 'audio/mpeg', name: 'private-title.mp3' };
    const report = await diagnoseAudioImport(new DOMException('quota', 'QuotaExceededError'), file);
    const result = JSON.parse(report);
    expect(result.probes.metadata.write).toBe('ok');
    expect(result.probes.binary32KB.write).toBe('ok');
    expect(result.probes.blob32KB.write).toBe('ok');
    expect(result.version).toBe(2);
    expect(result.probes.sameDatabaseNewConnection.write).toBe('ok');
    expect(result.probes.separateDatabase.write).toBe('ok');
    expect(result.probes.opfs32KB.write).toBe('unsupported');
    expect((await Dexie.getDatabaseNames()).filter((name) => name.startsWith('wm-import-probe-'))).toEqual([]);
    expect(result.storageBefore.usage).toBe(331e6);
    expect(result.file).toEqual({ bytes: 9e6, mimeType: 'audio/mpeg' });
    expect(report).not.toContain('private-title');
    expect(await db.settings.toArray()).toEqual([{ key: 'user-setting', value: 'preserve' }]);
  });

  it('distinguishes a Blob refusal from successful metadata and binary commits', async () => {
    const failBlob = (_key: unknown, record: { value: unknown }) => {
      if (record.value instanceof Blob) throw new DOMException('quota', 'QuotaExceededError');
    };
    db.settings.hook('creating', failBlob);
    try {
      const result = JSON.parse(await diagnoseAudioImport(new Error('failed'), { size: 9e6, type: 'audio/mpeg' }));
      expect(result.probes.metadata.write).toBe('ok');
      expect(result.probes.binary32KB.write).toBe('ok');
      expect(result.probes.blob32KB.write).toContain('QuotaExceededError');
      expect(await db.settings.count()).toBe(1);
    } finally { db.settings.hook('creating').unsubscribe(failBlob); }
  });

  it('cleans up only its own cache and OPFS file after successful committed writes', async () => {
    const cachePut = vi.fn(async () => {});
    const cacheDelete = vi.fn(async () => true);
    vi.stubGlobal('caches', { keys: async () => ['wm-models-v1'], open: async () => ({ put: cachePut }), delete: cacheDelete });
    const writer = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    const file = { createWritable: async () => writer, getFile: async () => ({ size: 32 * 1024 }) };
    const root = { getFileHandle: vi.fn(async () => file), removeEntry: vi.fn(async () => {}) };
    vi.stubGlobal('navigator', { userAgent: 'test', storage: { getDirectory: async () => root } });
    const result = JSON.parse(await diagnoseAudioImport(new Error('quota'), { size: 9e6, type: 'audio/mpeg' }));
    expect(result.probes.cacheStorage32KB.write).toBe('ok');
    expect(result.probes.opfs32KB.write).toBe('ok');
    expect(cacheDelete).toHaveBeenCalledWith(expect.stringMatching(/^wm-import-probe-/));
    expect(root.removeEntry).toHaveBeenCalledWith(expect.stringMatching(/^wm-import-probe-/));
    expect(writer.close).toHaveBeenCalledTimes(1);
    expect(await db.settings.toArray()).toEqual([{ key: 'user-setting', value: 'preserve' }]);
  });

  it('captures OPFS refusal and still aborts and removes its own incomplete probe', async () => {
    const writer = { write: vi.fn(async () => { throw new DOMException('quota', 'QuotaExceededError'); }), abort: vi.fn(async () => {}) };
    const root = { getFileHandle: async () => ({ createWritable: async () => writer }), removeEntry: vi.fn(async () => {}) };
    vi.stubGlobal('navigator', { userAgent: 'test', storage: { getDirectory: async () => root } });
    const result = JSON.parse(await diagnoseAudioImport(new Error('quota'), { size: 9e6, type: 'audio/mpeg' }));
    expect(result.probes.opfs32KB.write).toContain('QuotaExceededError');
    expect(writer.abort).toHaveBeenCalledTimes(1);
    expect(root.removeEntry).toHaveBeenCalledTimes(1);
  });
});
