import { ANALYSIS_SAMPLE_RATE } from '@will-music/engine';

// The browser's decoder resamples to the context rate (22050 Hz) directly; channels are kept for the mean downmix.
export const decodeForAnalysis = async (file: Blob): Promise<{ channels: Float32Array[]; sampleRate: number; durationSec: number }> => {
  const context = new OfflineAudioContext(2, 1, ANALYSIS_SAMPLE_RATE);
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).slice());
  return { channels, sampleRate: buffer.sampleRate, durationSec: buffer.duration };
};
