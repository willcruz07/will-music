const CHORDMINI = 'https://huggingface.co/musetric/chordmini-onnx/resolve/8ab85fc0f61439900cd07ac21257a43eac57075c';
const SKEY = 'https://huggingface.co/musetric/skey-onnx/resolve/9d90d2a9ff6679df1d64000f4fa750643f247643';

export type ModelId = 'chordnet' | 'cqtPlan' | 'skey';

/** Pinned model files (revision + SHA-256). Shared by the app and the Phase 0 tool. */
export const MODELS: Record<ModelId, { url: string; sha256: string; file: string; bytes: number }> = {
  chordnet: { url: `${CHORDMINI}/chordnet.onnx`, sha256: '1faee8e1cf168300afe0f47517e76836ac200c3841b0fb430fad7dfea5ad6394', file: 'chordnet.onnx', bytes: 17080550 },
  cqtPlan: { url: `${CHORDMINI}/cqt-plan.bin`, sha256: 'c31f0a6fd2d582d753be6628b5daecdee58acba53cba93b2bc2b5c75dee2ba48', file: 'cqt-plan.bin', bytes: 23896 },
  skey: { url: `${SKEY}/skey.onnx`, sha256: '5113c1378c1007c8559fcb767593366ba9794397b060535eb80a113db50530fc', file: 'skey.onnx', bytes: 338482 },
};

export const modelVersion = (id: ModelId): string => `${MODELS[id].file}@${MODELS[id].sha256.slice(0, 12)}`;
