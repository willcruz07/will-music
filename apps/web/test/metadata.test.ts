import { describe, expect, it, vi } from 'vitest';

const parseBlob = vi.fn();
vi.mock('music-metadata', () => ({ parseBlob: (...args: unknown[]) => parseBlob(...args) }));

const { readTags } = await import('../src/lib/metadata.ts');

describe('readTags', () => {
  it('falls back to the file name when there are no tags', async () => {
    parseBlob.mockResolvedValueOnce({ common: {}, format: {} });
    expect(await readTags(new File(['x'], 'Minha Música.mp3'))).toEqual({ title: 'Minha Música', artist: '', durationSec: 0 });
  });

  it('uses ID3 title, artist and duration', async () => {
    parseBlob.mockResolvedValueOnce({ common: { title: 'Primeiros Passos', artist: 'Ton Carfi' }, format: { duration: 208.48 } });
    expect(await readTags(new File(['x'], 'arquivo.mp3'))).toEqual({ title: 'Primeiros Passos', artist: 'Ton Carfi', durationSec: 208.48 });
  });

  it('survives unreadable metadata', async () => {
    parseBlob.mockRejectedValueOnce(new Error('bad file'));
    expect(await readTags(new File(['x'], 'quebrado.m4a'))).toEqual({ title: 'quebrado', artist: '', durationSec: 0 });
  });
});
