import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSong, db, type StemsRecord } from '../src/lib/db.ts';
import { type PipelineProgress, runPipeline } from '../src/lib/pipeline.ts';
import * as lrclib from '../src/lib/lrclib.ts';
import * as whisper from '../src/lib/whisper.ts';
import * as source from '../src/lib/analysisAudio.ts';
import { analyzeInWorker } from '../src/worker/client.ts';
import { clearPendingAnalysis, getPendingAnalysis } from '../src/lib/pendingAnalysis.ts';
import { savePendingAnalysis } from '../src/lib/saveAnalysis.ts';
import { exportSongs, readPackage } from '../src/lib/package.ts';

vi.mock('../src/worker/client.ts', () => ({ analyzeInWorker: vi.fn() }));
vi.mock('../src/lib/decode.ts', () => ({ decodeForAnalysis: vi.fn(async () => ({ channels: [new Float32Array(8)], durationSec: 8 })) }));
vi.mock('../src/lib/analysisAudio.ts', () => ({ prepareAnalysisStems: vi.fn(), decodeHarmonicAudio: vi.fn() }));
vi.mock('../src/lib/whisper.ts', () => ({ transcribeSong: vi.fn() }));

const stems: StemsRecord = { songId: '', mode: 'six', model: 'test', sampleRate: 44100, tracks: [], createdAt: '', selectedAt: '' };
beforeEach(async () => {
  await Promise.all([db.songs.clear(), db.audio.clear(), db.analyses.clear(), db.charts.clear()]);
  vi.clearAllMocks();
  vi.mocked(source.prepareAnalysisStems).mockResolvedValue({ stems });
  vi.mocked(source.decodeHarmonicAudio).mockResolvedValue({ channels: [new Float32Array(4)], durationSec: 8, sampleRate: 22050 });
  vi.mocked(whisper.transcribeSong).mockResolvedValue({ lines: [{ start: 0, text: 'Olha que coisa mais linda' }], usedVocals: true });
  vi.mocked(analyzeInWorker).mockResolvedValue({ models: {}, key: { root: 'C', mode: 'major', label: 'C major', index: 0, margin: 1 }, chords: [{ start: 0, end: 4, raw: 'C:maj', label: 'C' }] });
});
const makeSong = () => createSong({ title: 'Inédita', artist: 'Banda', durationSec: 8 }, new Blob(['x'], { type: 'audio/mpeg' }));

describe('original-audio pipeline', () => {
  it.each(['iPhone', 'Android Mobile', 'Macintosh'])('runs only chords on mobile %s without launching separation or Whisper', async userAgent => {
    vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 5, hardwareConcurrency: 4 });
    try {
      const song = await makeSong();
      const events: import('../src/lib/pipeline.ts').PipelineProgress[] = [];
      await runPipeline(song.id, event => events.push(event), { execution: 'parallel' });
      expect(source.prepareAnalysisStems).not.toHaveBeenCalled();
      expect(whisper.transcribeSong).not.toHaveBeenCalled();
      expect(analyzeInWorker).toHaveBeenCalledTimes(1);
      expect(events.some(event => event.tasks?.find(task => task.id === 'lyrics')?.status === 'skipped')).toBe(true);
      expect((await db.analyses.where('songId').equals(song.id).first())?.chords.length).toBeGreaterThan(0);
    } finally { vi.unstubAllGlobals(); }
  });
  it('preserves a computed result when final storage is refused, exports it and retries without rerunning models', async () => {
    const song = await makeSong();
    const refuse = () => { throw Object.assign(new Error('QuotaExceededError'), { name: 'AbortError' }); };
    db.analyses.hook('creating', refuse);
    try {
      await runPipeline(song.id, () => {});
      const result = getPendingAnalysis(song.id);
      expect(result!.analysis.lyrics!.lines[0]!.text).toBe('Olha que coisa mais linda');
      expect(result!.chart.chordPro).toContain('Olha que coisa mais linda');
      expect(result!.song.analysisStatus).toBe('done');
      expect(await db.analyses.where('songId').equals(song.id).count()).toBe(0);
      const exported = await readPackage(await exportSongs([song.id], { kind: 'song', includeAudio: false }));
      expect(exported.songs[0]!.analysis!.lyrics!.lines[0]!.text).toBe('Olha que coisa mais linda');
      expect(exported.songs[0]!.chart!.chordPro).toBe(result!.chart.chordPro);
      await expect(savePendingAnalysis(song.id)).rejects.toThrow('QuotaExceededError');
      expect(getPendingAnalysis(song.id)).toBe(result);
      db.analyses.hook('creating').unsubscribe(refuse);
      await savePendingAnalysis(song.id);
      expect(getPendingAnalysis(song.id)).toBeUndefined();
      expect(await db.analyses.where('songId').equals(song.id).count()).toBe(1);
      expect(await db.charts.where('songId').equals(song.id).count()).toBe(1);
      expect(analyzeInWorker).toHaveBeenCalledTimes(1);
      expect(whisper.transcribeSong).toHaveBeenCalledTimes(1);
    } finally { db.analyses.hook('creating').unsubscribe(refuse); clearPendingAnalysis(song.id); }
  });

  it('prepares tracks on desktop, analyzes original chords and then transcribes without searching', async () => {
    const search = vi.spyOn(lrclib, 'searchLyrics');
    const song = await makeSong();
    const events: PipelineProgress[] = [];
    await runPipeline(song.id, (p) => events.push(p));
    expect(analyzeInWorker).toHaveBeenCalledBefore(vi.mocked(whisper.transcribeSong));
    expect(source.prepareAnalysisStems).toHaveBeenCalledTimes(1);
    expect(source.decodeHarmonicAudio).not.toHaveBeenCalled();
    expect(whisper.transcribeSong).toHaveBeenCalledWith(song.id, expect.any(Function), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(search).not.toHaveBeenCalled();
    expect(events.at(-1)!.label).toBe('Montando sua música…');
    expect(events.some((e) => e.lyricsPending)).toBe(true);
    expect((await db.charts.where('songId').equals(song.id).first())!.chordPro).toContain('Olha que coisa mais linda');
    expect((await db.analyses.where('songId').equals(song.id).first())!.lyrics!.source).toBe('transcription');
    search.mockRestore();
  });

  it('does not start separation during the normal import', async () => {
    const song = await makeSong();
    await runPipeline(song.id, () => {});
    expect(source.decodeHarmonicAudio).not.toHaveBeenCalled();
    expect(analyzeInWorker).toHaveBeenCalled();
    expect((await db.analyses.where('songId').equals(song.id).first())!.models.audioSource).toBe('original');
  });

  it('keeps chords and a visible warning when transcription fails', async () => {
    vi.mocked(whisper.transcribeSong).mockRejectedValueOnce(new Error('Sem voz'));
    const song = await makeSong();
    await runPipeline(song.id, () => {});
    expect((await db.songs.get(song.id))!.analysisStatus).toBe('done');
    const analysis = await db.analyses.where('songId').equals(song.id).first();
    expect(analysis!.lyrics).toBeUndefined();
    expect(analysis!.warnings!.some((text) => text.includes('transcrever'))).toBe(true);
    expect(await db.charts.where('songId').equals(song.id).first()).toBeTruthy();
  });

  it('preserves user lyrics and edited charts on reanalysis', async () => {
    const song = await makeSong();
    await runPipeline(song.id, () => {});
    const analysis = (await db.analyses.where('songId').equals(song.id).first())!;
    const chart = (await db.charts.where('songId').equals(song.id).first())!;
    await db.analyses.update(analysis.id, { lyrics: { source: 'manual', lines: [{ start: 2, text: 'Minha correção' }] } });
    await db.charts.update(chart.id, { origin: 'edited', chordPro: '[G]Minha cifra' });
    vi.mocked(whisper.transcribeSong).mockClear();
    await runPipeline(song.id, () => {});
    expect(whisper.transcribeSong).not.toHaveBeenCalled();
    expect((await db.analyses.where('songId').equals(song.id).first())!.lyrics!.lines[0]!.text).toBe('Minha correção');
    expect((await db.charts.get(chart.id))!.chordPro).toBe('[G]Minha cifra');
  });

  it('makes the chord chart available while transcription is still running', async () => {
    let readyBeforeLyrics = false;
    vi.mocked(whisper.transcribeSong).mockImplementationOnce(async (id) => {
      readyBeforeLyrics = !!(await db.charts.where('songId').equals(id).first());
      return { lines: [{ start: 0, text: 'Olha que coisa mais linda' }], usedVocals: false };
    });
    const song = await makeSong();
    await runPipeline(song.id, () => {});
    expect(analyzeInWorker).toHaveBeenCalled();
    expect(readyBeforeLyrics).toBe(true);
    expect((await db.songs.get(song.id))!.analysisStatus).toBe('done');
  });

  it('does not hide the original failure when recording the error status is also refused', async () => {
    const song = await makeSong();
    const original = new Error('Falha original do modelo');
    vi.mocked(analyzeInWorker).mockRejectedValueOnce(original);
    const refuseStatus = (changes: unknown) => {
      if ((changes as { analysisStatus?: string }).analysisStatus === 'error') throw Object.assign(new Error('QuotaExceededError'), { name: 'AbortError' });
    };
    db.songs.hook('updating', refuseStatus);
    try { await expect(runPipeline(song.id, () => {})).rejects.toBe(original); }
    finally { db.songs.hook('updating').unsubscribe(refuseStatus); }
  });
});
