const CHORDMINI = 'https://huggingface.co/musetric/chordmini-onnx/resolve/8ab85fc0f61439900cd07ac21257a43eac57075c';
const SKEY = 'https://huggingface.co/musetric/skey-onnx/resolve/9d90d2a9ff6679df1d64000f4fa750643f247643';

const BASIC_PITCH_REPO = 'https://huggingface.co/daserge/basic-pitch-onnx/resolve/2633e680fb5a1c551cee4905410115b6715862f6';

const KARA2 = 'https://huggingface.co/musetric/mel-band-roformer-duality-kara2-student-onnx/resolve/48a53200678a45f88e21dc1af957f1e4b55ba5ae';

export type ModelId = 'chordnet' | 'cqtPlan' | 'skey' | 'kara2Core' | 'kara2Data' | 'basicPitch';

/** Pinned model files (revision + SHA-256). Shared by the app and the Phase 0 tool. */
export const MODELS: Record<ModelId, { url: string; sha256: string; file: string; bytes: number }> = {
  chordnet: { url: `${CHORDMINI}/chordnet.onnx`, sha256: '1faee8e1cf168300afe0f47517e76836ac200c3841b0fb430fad7dfea5ad6394', file: 'chordnet.onnx', bytes: 17080550 },
  cqtPlan: { url: `${CHORDMINI}/cqt-plan.bin`, sha256: 'c31f0a6fd2d582d753be6628b5daecdee58acba53cba93b2bc2b5c75dee2ba48', file: 'cqt-plan.bin', bytes: 23896 },
  skey: { url: `${SKEY}/skey.onnx`, sha256: '5113c1378c1007c8559fcb767593366ba9794397b060535eb80a113db50530fc', file: 'skey.onnx', bytes: 338482 },
  kara2Core: { url: `${KARA2}/duality_kara2_student_core_t1100.onnx`, sha256: '86a884e0225233a7d77f88e60d9a7e2febdb0d386d19ddc9476fcf51ed858228', file: 'duality_kara2_student_core_t1100.onnx', bytes: 6230015 },
  kara2Data: { url: `${KARA2}/duality_kara2_student_core_t1100.onnx.data`, sha256: '176673d2446d8578976dd1a17ebca5fa0651dd23446967ff44fad5bf22c45d5c', file: 'duality_kara2_student_core_t1100.onnx.data', bytes: 235400588 },
  // Spotify Basic Pitch (Apache-2.0), byte-identical to basic_pitch/saved_models/icassp_2022/nmp.onnx.
  basicPitch: { url: `${BASIC_PITCH_REPO}/nmp.onnx`, sha256: '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec', file: 'nmp.onnx', bytes: 230444 },
};

export const modelVersion = (id: ModelId): string => `${MODELS[id].file}@${MODELS[id].sha256.slice(0, 12)}`;
