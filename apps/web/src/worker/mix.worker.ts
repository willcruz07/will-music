/// <reference lib="webworker" />
import { createAlignedMp3 } from '../lib/mp3.ts';

export type MixRequest = { left: Float32Array; right: Float32Array; sampleRate: number; bitrate?: number };
export type MixResponse = { type: 'result'; mp3: ArrayBuffer } | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<MixRequest>) => {
  try {
    const { left, right, sampleRate, bitrate = 192 } = event.data;
    const enc = await createAlignedMp3(sampleRate, bitrate);
    enc.push(left, right);
    const out = new Uint8Array(enc.finish());
    (self as DedicatedWorkerGlobalScope).postMessage({ type: 'result', mp3: out.buffer } satisfies MixResponse, [out.buffer]);
  } catch (error) {
    (self as DedicatedWorkerGlobalScope).postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) } satisfies MixResponse);
  }
};
