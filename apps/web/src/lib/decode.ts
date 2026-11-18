import { ANALYSIS_SAMPLE_RATE, SEPARATION_GEOMETRY, downmixMean, toStereoPlanar } from '@will-music/engine';

// The browser's decoder resamples to the context rate (22050 Hz) directly; channels are kept for the mean downmix.
export const decodeForAnalysis = async (file: Blob, options: { mono?: boolean } = {}): Promise<{ channels: Float32Array[]; sampleRate: number; durationSec: number }> => {
  const context = new OfflineAudioContext(2, 1, ANALYSIS_SAMPLE_RATE);
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  const source = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const channels = options.mono ? [downmixMean(source)] : source.map((channel) => channel.slice());
  return { channels, sampleRate: buffer.sampleRate, durationSec: buffer.duration };
};

/** Resamples mono audio with the browser's own resampler (native and asynchronous, so the page stays responsive). */
export const resampleMono = async (input: Float32Array, fromRate: number, toRate: number): Promise<Float32Array> => {
  const context = new OfflineAudioContext(1, Math.max(1, Math.ceil((input.length * toRate) / fromRate)), toRate);
  const buffer = context.createBuffer(1, Math.max(1, input.length), fromRate);
  buffer.getChannelData(0).set(input);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  return (await context.startRendering()).getChannelData(0);
};

/**
 * Desktop studio: one decode of the file serves both models — stereo at the separation rate for the tracks, and the
 * mono 22.05 kHz chord input resampled from it (instead of asking the browser to decode the whole file twice).
 */
export const decodeStudioAudio = async (file: Blob) => {
  const context = new OfflineAudioContext(2, 1, SEPARATION_GEOMETRY.sampleRate);
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  const source = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const chordInput = await resampleMono(downmixMean(source), SEPARATION_GEOMETRY.sampleRate, ANALYSIS_SAMPLE_RATE);
  return {
    separation: toStereoPlanar(source),
    chords: { channels: [chordInput], sampleRate: ANALYSIS_SAMPLE_RATE, durationSec: buffer.duration },
  };
};
