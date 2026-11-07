/// <reference lib="webworker" />
import { createMp3Encoder } from 'wasm-media-encoders';

export type MixRequest = { left: Float32Array; right: Float32Array; sampleRate: number; bitrate?: number };
export type MixResponse = { type: 'result'; mp3: ArrayBuffer } | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<MixRequest>) => {
  try {
    const { left, right, sampleRate, bitrate = 192 } = event.data;
    const encoder = await createMp3Encoder();
    encoder.configure({ sampleRate, channels: 2, bitrate: bitrate as 192 });
    const parts: Uint8Array[] = [];
    for (let i = 0; i < left.length; i += sampleRate) parts.push(encoder.encode([left.subarray(i, i + sampleRate), right.subarray(i, i + sampleRate)]).slice());
    parts.push(encoder.finalize().slice());
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    (self as DedicatedWorkerGlobalScope).postMessage({ type: 'result', mp3: out.buffer } satisfies MixResponse, [out.buffer]);
  } catch (error) {
    (self as DedicatedWorkerGlobalScope).postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) } satisfies MixResponse);
  }
};
