import { describe, expect, it } from 'vitest';
import { distributePlainLyrics, type LrclibResult, parseLrc, pickBestLyrics, searchLyrics } from '../src/lib/lrclib.ts';

const res = ({ id, duration, synced }: { id: number; duration: number; synced: boolean }): LrclibResult => ({
  id, trackName: 't', artistName: 'a', duration, syncedLyrics: synced ? '[00:01.00] x' : null, plainLyrics: 'x',
});

describe('lrclib', () => {
  it('parses LRC', () => {
    expect(parseLrc('[00:19.32] Linha um\n\n[01:02.5] Dois\n[01:03.00]')).toEqual([
      { start: 19.32, text: 'Linha um' },
      { start: 62.5, text: 'Dois' },
    ]);
  });

  it('picks synced lyrics closest in duration and warns on mismatch', () => {
    const r = [res({ id: 1, duration: 300, synced: true }), res({ id: 2, duration: 213, synced: true }), res({ id: 3, duration: 212, synced: false })];
    expect(pickBestLyrics(r, 212)!.result.id).toBe(2);
    expect(pickBestLyrics(r, 212)!.warning).toBeUndefined();
    expect(pickBestLyrics([res({ id: 1, duration: 300, synced: true })], 212)!.warning).toMatch(/outra versão/);
    expect(pickBestLyrics([res({ id: 9, duration: 212, synced: false })], 212)!.result.id).toBe(9);
    expect(pickBestLyrics([], 212)).toBeNull();
  });

  it('queries the search endpoint and returns [] on failure', async () => {
    let url = '';
    const ok = await searchLyrics('Ninguém Explica Deus', 'Preto no Branco', async (input) => {
      url = String(input);
      return new Response(JSON.stringify([res({ id: 5, duration: 1, synced: true })]));
    });
    expect(url).toBe('https://lrclib.net/api/search?track_name=Ningu%C3%A9m+Explica+Deus&artist_name=Preto+no+Branco');
    expect(ok.map((r) => r.id)).toEqual([5]);
    expect(await searchLyrics('a', 'b', async () => { throw new Error('offline'); })).toEqual([]);
    expect(await searchLyrics('a', 'b', async () => new Response('x', { status: 500 }))).toEqual([]);
  });

  it('distributes plain lyrics over the song', () => {
    expect(distributePlainLyrics('a\n\nb', 100).map((l) => [l.start, l.text])).toEqual([[10, 'a'], [50, 'b']]);
  });
});

describe('lrclib fallbacks', () => {
  it('falls back to a free-text search when the exact search is empty', async () => {
    const urls: string[] = [];
    const found = await searchLyrics('Imperfeito', 'Coral Canto Jovem', async (input) => {
      urls.push(String(input));
      return new Response(JSON.stringify(urls.length === 1 ? [] : [res({ id: 7, duration: 290, synced: true })]));
    });
    expect(urls[1]).toBe('https://lrclib.net/api/search?q=Imperfeito+Coral+Canto+Jovem');
    expect(found.map((r) => r.id)).toEqual([7]);
  });

  it('does not auto-pick lyrics from another artist', () => {
    const other = { ...res({ id: 1, duration: 208, synced: true }), artistName: 'Vida Reluz' };
    const same = { ...res({ id: 2, duration: 300, synced: true }), artistName: 'Ton Carfi e Convidados' };
    expect(pickBestLyrics([other], 208, 'Ton Carfi')).toBeNull();
    expect(pickBestLyrics([other, same], 208, 'Ton Carfi')!.result.id).toBe(2);
    expect(pickBestLyrics([other], 208, '')!.result.id).toBe(1);
  });
});
