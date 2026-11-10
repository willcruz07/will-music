import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type StemsRecord } from '../src/lib/db.ts';
import { decodeForAnalysis } from '../src/lib/decode.ts';
import { decodeHarmonicAudio, prepareAnalysisStems } from '../src/lib/analysisAudio.ts';
import { getSessionStems, retainSessionStems, setSessionStems } from '../src/lib/sessionStems.ts';
import { separateSong } from '../src/lib/stems.ts';

vi.mock('../src/lib/decode.ts', () => ({ decodeForAnalysis: vi.fn() }));
vi.mock('../src/lib/stems.ts', async (original) => ({ ...(await original<typeof import('../src/lib/stems.ts')>()), separateSong: vi.fn() }));
const record = (): StemsRecord => ({ songId: 'audio', mode: 'six', model: 'test', sampleRate: 44100,
  tracks: ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'].map((name) => ({ name: name as StemsRecord['tracks'][number]['name'], blob: new Blob([name]) })), createdAt: '', selectedAt: '' });
beforeEach(async () => { vi.clearAllMocks(); await db.stemSets.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('analysis audio sources', () => {
  it('mixes only bass, guitar, piano and other, keeping their shared time axis', async () => {
    const stems = record();
    vi.mocked(decodeForAnalysis).mockResolvedValue({ channels: [new Float32Array([0, 0.1, 0])], sampleRate: 22050, durationSec: 3 / 22050 });
    const mix = await decodeHarmonicAudio(stems);
    expect(vi.mocked(decodeForAnalysis).mock.calls.map(([blob]) => stems.tracks.find((track) => track.blob === blob)!.name)).toEqual(['bass', 'guitar', 'piano', 'other']);
    expect(mix.channels[0]![0]).toBe(0);
    expect(mix.channels[0]![1]).toBeCloseTo(0.4);
    expect(mix.channels[0]![2]).toBe(0);
  });

  it('reuses session tracks without separating again', async () => {
    const release = retainSessionStems('audio');
    try {
      const stems = record();
      setSessionStems('audio', stems);
      expect((await prepareAnalysisStems('audio', () => {})).stems).toBe(stems);
      expect(separateSong).not.toHaveBeenCalled();
    } finally { release(); }
  });

  it('uses original audio on unsupported devices', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test' });
    expect((await prepareAnalysisStems('audio', () => {})).warning).toContain('original');
    expect(separateSong).not.toHaveBeenCalled();
  });

  it('publishes newly separated tracks without persisting them', async () => {
    vi.stubGlobal('navigator', { userAgent: 'test', gpu: { requestAdapter: async () => ({}) } });
    const release = retainSessionStems('audio');
    try {
      const stems = record();
      vi.mocked(separateSong).mockResolvedValueOnce({ record: stems, persisted: false });
      expect((await prepareAnalysisStems('audio', () => {})).stems).toBe(stems);
      expect(getSessionStems('audio')).toBe(stems);
      expect(separateSong).toHaveBeenCalledWith('audio', expect.any(Function), { mode: 'six', persist: false });
    } finally { release(); }
  });
});
