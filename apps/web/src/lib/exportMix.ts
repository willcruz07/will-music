import type { MixRequest, MixResponse } from '../worker/mix.worker.ts';

const RATE = 44100;

/** Adds the tracks with their volumes into one stereo buffer and keeps peaks under 0.99. */
export const sumTracks = (tracks: readonly { left: Float32Array; right: Float32Array; volume: number }[]): { left: Float32Array; right: Float32Array } => {
  const length = Math.max(0, ...tracks.map((t) => t.left.length));
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (const t of tracks) {
    for (let i = 0; i < t.left.length; i++) {
      left[i] = left[i]! + t.left[i]! * t.volume;
      right[i] = right[i]! + t.right[i]! * t.volume;
    }
  }
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
  if (peak > 0.99) {
    const k = 0.99 / peak;
    for (let i = 0; i < length; i++) {
      left[i] = left[i]! * k;
      right[i] = right[i]! * k;
    }
  }
  return { left, right };
};

/**
 * Running stereo sum: each track is added and can be dropped right away, so only one decoded track
 * and the sum are in memory at a time. The peak is limited once, at the end.
 */
export const createMixSum = () => {
  let left = new Float32Array(0);
  let right = new Float32Array(0);
  return {
    add(l: Float32Array, r: Float32Array, volume: number) {
      if (l.length > left.length) {
        const grow = (old: Float32Array) => {
          const next = new Float32Array(l.length);
          next.set(old);
          return next;
        };
        left = grow(left);
        right = grow(right);
      }
      for (let i = 0; i < l.length; i++) {
        left[i] = left[i]! + l[i]! * volume;
        right[i] = right[i]! + r[i]! * volume;
      }
    },
    finish() {
      let peak = 0;
      for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i]!), Math.abs(right[i]!));
      if (peak > 0.99) {
        const k = 0.99 / peak;
        for (let i = 0; i < left.length; i++) {
          left[i] = left[i]! * k;
          right[i] = right[i]! * k;
        }
      }
      return { left, right };
    },
  };
};

const decodeStereo = async (blob: Blob) => {
  const context = new OfflineAudioContext(2, 1, RATE);
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  const left = buffer.getChannelData(0);
  return { left, right: buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left };
};

/** Renders the current mix (only audible tracks) to an MP3 file. */
export const exportMixMp3 = async (tracks: readonly { blob: Blob; volume: number }[], onStep: (label: string) => void): Promise<Blob> => {
  const audible = tracks.filter((t) => t.volume > 0);
  if (!audible.length) throw new Error('Todas as faixas estão mudas: não há nada para salvar.');
  const sum = createMixSum();
  for (const [i, t] of audible.entries()) {
    onStep(`Preparando as faixas (${i + 1} de ${audible.length})`);
    const track = await decodeStereo(t.blob);
    sum.add(track.left, track.right, t.volume);
  }
  onStep('Gerando o MP3');
  const { left, right } = sum.finish();
  return encodeMp3(left, right, RATE, 192);
};

/** Encodes stereo PCM to MP3 in a worker (the buffers are transferred). */
export const encodeMp3 = (left: Float32Array, right: Float32Array, sampleRate: number, bitrate: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../worker/mix.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<MixResponse>) => {
      worker.terminate();
      if (event.data.type === 'result') resolve(new Blob([event.data.mp3], { type: 'audio/mpeg' }));
      else reject(new Error(event.data.message));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Não foi possível gerar o MP3.'));
    };
    worker.postMessage({ left, right, sampleRate, bitrate } satisfies MixRequest, [left.buffer, right.buffer]);
  });
