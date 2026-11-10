import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSong, db } from '../src/lib/db.ts';
import { runPipeline, type PipelineProgress } from '../src/lib/pipeline.ts';
import { analyzeInWorker } from '../src/worker/client.ts';
import { transcribeSong } from '../src/lib/whisper.ts';

vi.mock('../src/worker/client.ts', () => ({ analyzeInWorker: vi.fn() }));
vi.mock('../src/lib/whisper.ts', () => ({ transcribeSong: vi.fn() }));
vi.mock('../src/lib/decode.ts', () => ({ decodeForAnalysis: vi.fn(async () => ({ channels: [new Float32Array(8)], durationSec: 8 })) }));
const harmony = { models: {}, key: { root: 'C', mode: 'major' as const, label: 'C major', index: 0, margin: 1 }, chords: [{ start: 0, end: 4, raw: 'C:maj', label: 'C' }] };
const transcript = { lines: [{ start: 0, text: 'Uma letra reconhecida' }], usedVocals: false };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
beforeEach(async () => {
  vi.resetAllMocks();
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
});
const song = () => createSong({ title: 'Paralela', artist: '', durationSec: 8 }, new Blob(['audio']));

describe('parallel song processing', () => {
  it('starts both tasks before either finishes and publishes chords while lyrics are still pending', async () => {
    const chords = deferred<typeof harmony>();
    const lyrics = deferred<typeof transcript>();
    vi.mocked(analyzeInWorker).mockReturnValue(chords.promise);
    vi.mocked(transcribeSong).mockReturnValue(lyrics.promise);
    const entry = await song();
    const events: PipelineProgress[] = [];
    const processing = runPipeline(entry.id, (p) => events.push(p), { execution: 'parallel' });
    await vi.waitFor(() => expect(transcribeSong).toHaveBeenCalledTimes(1));
    expect(analyzeInWorker).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.tasks?.every((task) => task.status === 'running'))).toBe(true);
    chords.resolve(harmony);
    await vi.waitFor(async () => expect(await db.charts.where('songId').equals(entry.id).first()).toBeTruthy());
    expect(events.some((e) => e.lyricsPending)).toBe(true);
    lyrics.resolve(transcript);
    await processing;
    const result = (await db.analyses.where('songId').equals(entry.id).first())!;
    expect(result.processing!.execution).toBe('parallel');
    expect(result.lyrics!.lines[0]!.text).toBe('Uma letra reconhecida');
    expect(transcribeSong).toHaveBeenCalledTimes(1);
  });

  it('merges lyrics that finish first without requiring another transcription', async () => {
    const chords = deferred<typeof harmony>();
    vi.mocked(analyzeInWorker).mockReturnValue(chords.promise);
    vi.mocked(transcribeSong).mockResolvedValue(transcript);
    const entry = await song();
    const processing = runPipeline(entry.id, () => {}, { execution: 'parallel' });
    await vi.waitFor(() => expect(transcribeSong).toHaveBeenCalledTimes(1));
    chords.resolve(harmony);
    await processing;
    expect((await db.charts.where('songId').equals(entry.id).first())!.chordPro).toContain('Uma letra reconhecida');
    expect(transcribeSong).toHaveBeenCalledTimes(1);
  });

  it('retries a resource-related transcript failure once after the chord worker finishes', async () => {
    const chords = deferred<typeof harmony>();
    vi.mocked(analyzeInWorker).mockReturnValue(chords.promise);
    vi.mocked(transcribeSong).mockRejectedValueOnce(new Error('WebGPU out of memory')).mockResolvedValueOnce(transcript);
    const entry = await song();
    const processing = runPipeline(entry.id, () => {}, { execution: 'parallel' });
    await vi.waitFor(() => expect(transcribeSong).toHaveBeenCalledTimes(1));
    expect(transcribeSong).toHaveBeenCalledTimes(1);
    chords.resolve(harmony);
    await processing;
    expect(transcribeSong).toHaveBeenCalledTimes(2);
    expect((await db.analyses.where('songId').equals(entry.id).first())!.processing!.transcriptionRetried).toBe(true);
  });

  it('does not retry unintelligible lyrics and retains the valid chords', async () => {
    vi.mocked(analyzeInWorker).mockResolvedValue(harmony);
    vi.mocked(transcribeSong).mockRejectedValue(new Error('Não deu para entender a letra neste áudio.'));
    const entry = await song();
    await runPipeline(entry.id, () => {}, { execution: 'parallel' });
    expect(transcribeSong).toHaveBeenCalledTimes(1);
    expect((await db.analyses.where('songId').equals(entry.id).first())!.chords).toEqual(harmony.chords);
  });

  it('aborts the other task on fatal chord failure and preserves the original error', async () => {
    const chords = deferred<typeof harmony>();
    vi.mocked(analyzeInWorker).mockReturnValue(chords.promise);
    let aborted = false;
    vi.mocked(transcribeSong).mockImplementation((_id, _progress, source) => new Promise((_resolve, reject) => {
      source!.signal!.addEventListener('abort', () => { aborted = true; reject(source!.signal!.reason); });
    }));
    const entry = await song();
    const original = new Error('Modelo inválido');
    const processing = runPipeline(entry.id, () => {}, { execution: 'parallel' });
    const rejected = expect(processing).rejects.toBe(original);
    await vi.waitFor(() => expect(transcribeSong).toHaveBeenCalled());
    chords.reject(original);
    await rejected;
    expect(aborted).toBe(true);
  });
});
