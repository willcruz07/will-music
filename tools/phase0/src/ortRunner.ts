import type { TensorRunner } from '@will-music/engine';
import * as ort from 'onnxruntime-node';

export const createOrtRunner = async (modelPath: string): Promise<TensorRunner> => {
  const session = await ort.InferenceSession.create(modelPath, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' });
  return {
    async run(feeds) {
      const inputs: Record<string, ort.Tensor> = {};
      for (const [name, feed] of Object.entries(feeds)) inputs[name] = new ort.Tensor('float32', feed.data, [...feed.dims]);
      const outputs = await session.run(inputs);
      const result: Record<string, Float32Array> = {};
      for (const [name, tensor] of Object.entries(outputs)) {
        if (!(tensor.data instanceof Float32Array)) throw new Error(`Output ${name} is not float32`);
        result[name] = tensor.data;
      }
      return result;
    },
    release: () => session.release(),
  };
};
