import { ANALYSIS_SAMPLE_RATE, downmixMean } from '@will-music/engine';

// The browser's decoder resamples to the context rate (22050 Hz) directly; channels are kept for the mean downmix.
export const decodeForAnalysis = async (file: Blob, options: { mono?: boolean } = {}): Promise<{ channels: Float32Array[]; sampleRate: number; durationSec: number }> => {
  const context = new OfflineAudioContext(2, 1, ANALYSIS_SAMPLE_RATE);
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  const source = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const channels = options.mono ? [downmixMean(source)] : source.map((channel) => channel.slice());
  return { channels, sampleRate: buffer.sampleRate, durationSec: buffer.duration };
};
