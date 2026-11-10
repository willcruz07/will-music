import * as ort from 'onnxruntime-web/wasm';
import { unzipSync } from 'fflate';
import { computeLvFeatures, decodeLvChords, estimateLvTuning, type ChordSegment, type LvPlan, type LvCandidate, type ModelId } from '@will-music/engine';
import { fetchModel } from './models.ts';
const heads = ['triad', 'bass', 'seventh', 'ninth', 'eleventh', 'thirteenth'] as const;
const widths = [73, 13, 4, 4, 3, 3];
ort.env.wasm.numThreads = 1;

export const createLvAnalyzer = async (load: (id: ModelId) => Promise<Uint8Array<ArrayBuffer>> = fetchModel) => {
  const plans = await load('lvPlans');
  const dictionary = JSON.parse(new TextDecoder().decode(await load('lvDictionary'))) as LvCandidate[];
  return async (pcm: Float32Array<ArrayBuffer>, progress: (label: string) => void = () => {}): Promise<ChordSegment[]> => {
    if (!pcm.length || pcm.length > 22050 * 60) throw new Error('Bloco LV-Chordia inválido.');
    progress('Estimando afinação no navegador…');
    const tuning = estimateLvTuning(pcm);
    const planIndex = Math.max(0, Math.min(99, Math.round((tuning + 0.5) * 100)));
    const file = `cqt-${planIndex}.json`;
    const plan = JSON.parse(new TextDecoder().decode(unzipSync(plans, { filter: (entry) => entry.name === file })[file]!)) as LvPlan;
    const { data: features, frames } = computeLvFeatures(pcm, plan, (done, total) => progress(`Preparando CQT no navegador (${done}/${total})…`));
    if (!Number.isInteger(frames) || frames < 1) throw new Error('O CQT local retornou dimensões inválidas.');
    const sums = widths.map((width) => new Float32Array(frames * width));
    const input = new ort.Tensor('float32', features, [1, frames, 252]);
    try {
      for (let member = 0; member < 5; member++) {
        progress(`Executando rede ${member + 1} de 5 no navegador…`);
        const session = await ort.InferenceSession.create(await load(`lv${member}` as ModelId), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
        try {
          const outputs = await session.run({ features: input });
          try {
            heads.forEach((head, index) => {
              const values = outputs[head]?.data;
              const width = widths[index]!;
              if (!(values instanceof Float32Array) || values.length !== frames * width) throw new Error(`Saída inválida: ${head}`);
              const sum = sums[index]!;
              for (let frame = 0; frame < frames; frame++) {
                const offset = frame * width;
                let max = -Infinity;
                for (let col = 0; col < width; col++) max = Math.max(max, values[offset + col]!);
                let total = 0;
                for (let col = 0; col < width; col++) total += Math.exp(values[offset + col]! - max);
                for (let col = 0; col < width; col++) sum[offset + col] = sum[offset + col]! + Math.exp(values[offset + col]! - max) / total / 5;
              }
            });
          } finally {
            Object.values(outputs).forEach((tensor) => tensor.dispose());
          }
        } finally {
          await session.release();
        }
      }
    } finally {
      input.dispose();
    }
    progress('Interpretando acordes no navegador…');

    const chords = decodeLvChords(sums, frames, dictionary);

    return chords;
  };
};
