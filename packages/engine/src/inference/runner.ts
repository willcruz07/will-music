export type TensorFeed = { data: Float32Array; dims: readonly number[] };

/** Runtime-agnostic ONNX session: onnxruntime-node in tools, onnxruntime-web in the app. */
export interface TensorRunner {
  run(feeds: Record<string, TensorFeed>): Promise<Record<string, Float32Array>>;
  release(): Promise<void>;
}
