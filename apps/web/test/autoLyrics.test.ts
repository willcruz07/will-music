import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSong, db } from '../src/lib/db.ts';
import { type PipelineProgress, runPipeline } from '../src/lib/pipeline.ts';
import * as lrclib from '../src/lib/lrclib.ts';
import * as whisper from '../src/lib/whisper.ts';

vi.mock('../src/worker/client.ts', () => ({
  analyzeInWorker: vi.fn(async () => ({ models: {}, key: { root: 'C', mode: 'major', confidence: 1 }, chords: [{ start: 0, end: 4, raw: 'C:maj', label: 'C' }] })),
}));
vi.mock('../src/lib/decode.ts', () => ({ decodeForAnalysis: vi.fn(async () => ({ channels: [new Float32Array(8)], durationSec: 8 })) }));
vi.mock('../src/lib/lrclib.ts', async (orig) => ({ ...(await orig<typeof import('../src/lib/lrclib.ts')>()), searchLyrics: vi.fn(async () => []) }));
vi.mock('../src/lib/whisper.ts', async (orig) => ({
  ...(await orig<typeof import('../src/lib/whisper.ts')>()),
  transcribeSong: vi.fn(async () => ({ lines: [{ start: 0, end: 4, text: 'Olha que coisa mais linda' }], usedVocals: false })),
}));

beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
  vi.mocked(whisper.transcribeSong).mockClear();
});

describe('an audio always ends up with chords and lyrics', () => {
  it('transcribes the lyrics with Whisper when the lyrics search finds nothing', async () => {
    const song = await createSong({ title: 'Inédita', artist: 'Banda', durationSec: 8 }, new Blob(['x'], { type: 'audio/mpeg' }));
    let chartWhileListening: unknown;
    vi.mocked(whisper.transcribeSong).mockImplementationOnce(async (id, onProgress) => {
      chartWhileListening = await db.charts.where('songId').equals(id).first();
      onProgress({ stage: 'listen', done: 1, total: 3, heard: 'olha que coisa' });
      return { lines: [{ start: 0, text: 'Olha que coisa mais linda' }], usedVocals: false };
    });
    const events: PipelineProgress[] = [];
    await runPipeline(song.id, (p) => events.push(p));
    expect(whisper.transcribeSong).toHaveBeenCalledWith(song.id, expect.any(Function));
    // The chart with the chords is saved before Whisper starts, so the song page can show it meanwhile.
    expect(chartWhileListening).toBeDefined();
    expect(events.at(-1)).toEqual({ label: 'Transcrevendo a letra: trecho 2 de 3', fraction: 1 / 3, detail: '“…olha que coisa”', lyricsPending: true });
    const chart = await db.charts.where('songId').equals(song.id).first();
    expect(chart!.chordPro).toContain('Olha que coisa mais linda');
  });

  it('does not run Whisper when the lyrics are found', async () => {
    vi.mocked(lrclib.searchLyrics).mockResolvedValueOnce([{ id: 1, trackName: 'Inédita', artistName: 'Banda', duration: 8, plainLyrics: 'Uma linha', syncedLyrics: '[00:00.00] Uma linha' } as never]);
    const song = await createSong({ title: 'Inédita', artist: 'Banda', durationSec: 8 }, new Blob(['x'], { type: 'audio/mpeg' }));
    await runPipeline(song.id, () => {});
    expect(whisper.transcribeSong).not.toHaveBeenCalled();
  });

  it('keeps the chart when the transcription fails', async () => {
    vi.mocked(whisper.transcribeSong).mockRejectedValueOnce(new Error('Não deu para entender a letra neste áudio.'));
    const song = await createSong({ title: 'Instrumental', artist: '', durationSec: 8 }, new Blob(['x'], { type: 'audio/mpeg' }));
    await runPipeline(song.id, () => {});
    expect((await db.songs.get(song.id))!.analysisStatus).toBe('done');
    expect(await db.charts.where('songId').equals(song.id).first()).toBeTruthy();
  });
});
