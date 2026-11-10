import { Blob as NativeBlob } from 'node:buffer';
import { afterEach, expect, it, vi } from 'vitest';
import { transcribeSong } from '../src/lib/whisper.ts';
import { retainSessionStems, setSessionStems } from '../src/lib/sessionStems.ts';
import { db } from '../src/lib/db.ts';

afterEach(() => vi.unstubAllGlobals());

it('transcribes session vocals without reading the original from IndexedDB, retaining the intro time offset', async () => {
  vi.stubGlobal('Blob', NativeBlob);
  vi.stubGlobal('caches', { open: async () => ({ keys: async () => [] }) });
  vi.stubGlobal('navigator', { userAgent: 'test' });
  const audio = new Float32Array(32000);
  audio.fill(0.1, 16000);
  vi.stubGlobal('OfflineAudioContext', class {
    async decodeAudioData() { return { numberOfChannels: 1, length: audio.length, getChannelData: () => audio }; }
  });
  let received: Float32Array | undefined;
  vi.stubGlobal('Worker', class {
    onmessage?: (event: { data: unknown }) => void;
    postMessage(request: { audio: Float32Array }) {
      received = request.audio;
      queueMicrotask(() => this.onmessage?.({ data: { type: 'result', device: 'wasm', words: false, chunks: [
        { timestamp: [0, 0.4], text: 'Primeira frase cantada' },
        { timestamp: [0.4, 0.8], text: 'Segunda linha diferente' },
        { timestamp: [0.8, 1.2], text: 'Terceira parte da música' },
      ] } }));
    }
    terminate() {}
  });
  const original = vi.spyOn(db.audio, 'get');
  const release = retainSessionStems('session-transcription');
  try {
    setSessionStems('session-transcription', { songId: 'session-transcription', mode: 'six', model: 'test', sampleRate: 44100,
      tracks: [{ name: 'vocals', blob: new Blob(['voice'], { type: 'audio/mpeg' }) }], createdAt: '', selectedAt: '' });
    const result = await transcribeSong('session-transcription', () => {});
    expect(result.usedVocals).toBe(true);
    expect(original).not.toHaveBeenCalled();
    expect(received!.length).toBe(24000);
    expect(result.lines[0]!.start).toBe(0.5);
    expect(result.lines).toHaveLength(3);
  } finally { release(); original.mockRestore(); }
});
