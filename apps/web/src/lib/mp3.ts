import { createMp3Encoder } from 'wasm-media-encoders';

/**
 * LAME's encoder delay plus the MP3 decoder delay, in samples (576 + 529). Measured: a click encoded at
 * sample 44100 decodes at 45206. Without compensation every track would play ~25 ms late against the
 * original, which shifts chord, lyric and score timing.
 */
export const MP3_DELAY = 1105;

/**
 * Stereo MP3 encoder that cancels that delay: the first MP3_DELAY input samples are dropped and the end
 * is padded with silence, so the decoded file lines up sample by sample with what went in.
 */
export const createAlignedMp3 = async (sampleRate: number, bitrate = 192) => {
  const encoder = await createMp3Encoder();
  encoder.configure({ sampleRate, channels: 2, bitrate: bitrate as 192 });
  const parts: Uint8Array[] = [];
  let toSkip = MP3_DELAY;
  const STEP = sampleRate; // one second at a time keeps the encoder's own buffer small
  const encode = (left: Float32Array, right: Float32Array) => {
    for (let i = 0; i < left.length; i += STEP) parts.push(encoder.encode([left.subarray(i, i + STEP), right.subarray(i, i + STEP)]).slice());
  };
  return {
    push(left: Float32Array, right: Float32Array) {
      if (toSkip > 0) {
        const skip = Math.min(toSkip, left.length);
        toSkip -= skip;
        left = left.subarray(skip);
        right = right.subarray(skip);
      }
      if (left.length) encode(left, right);
    },
    finish(): ArrayBuffer {
      const pad = new Float32Array(MP3_DELAY);
      encode(pad, pad);
      parts.push(encoder.finalize().slice());
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let at = 0;
      for (const p of parts) {
        out.set(p, at);
        at += p.length;
      }
      return out.buffer;
    },
  };
};
