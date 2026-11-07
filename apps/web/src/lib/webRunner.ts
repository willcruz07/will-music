import type { TensorRunner } from '@will-music/engine';
import * as ort from 'onnxruntime-web/wasm';

// WASM files are copied to /ort/ by the copy-ort plugin in vite.config.ts.
ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
ort.env.wasm.numThreads = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
ort.env.logLevel = 'error';

export const createWebRunner = async (model: Uint8Array): Promise<TensorRunner> => {
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  return {
    async run(feeds) {
      const inputs: Record<string, ort.Tensor> = {};
      for (const [name, feed] of Object.entries(feeds)) inputs[name] = new ort.Tensor('float32', feed.data, [...feed.dims]);
      const outputs = await session.run(inputs);
      const result: Record<string, Float32Array> = {};
      for (const [name, tensor] of Object.entries(outputs)) {
        if (!(tensor.data instanceof Float32Array)) throw new Error(`Saída ${name} não é float32`);
        result[name] = tensor.data;
      }
      return result;
    },
    release: () => session.release(),
  };
};
