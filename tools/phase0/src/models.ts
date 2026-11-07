import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CHORDMINI = 'https://huggingface.co/musetric/chordmini-onnx/resolve/8ab85fc0f61439900cd07ac21257a43eac57075c';
const SKEY = 'https://huggingface.co/musetric/skey-onnx/resolve/9d90d2a9ff6679df1d64000f4fa750643f247643';

export type ModelId = 'chordnet' | 'cqtPlan' | 'skey';

export const MODELS: Record<ModelId, { url: string; sha256: string; file: string }> = {
  chordnet: { url: `${CHORDMINI}/chordnet.onnx`, sha256: '1faee8e1cf168300afe0f47517e76836ac200c3841b0fb430fad7dfea5ad6394', file: 'chordnet.onnx' },
  cqtPlan: { url: `${CHORDMINI}/cqt-plan.bin`, sha256: 'c31f0a6fd2d582d753be6628b5daecdee58acba53cba93b2bc2b5c75dee2ba48', file: 'cqt-plan.bin' },
  skey: { url: `${SKEY}/skey.onnx`, sha256: '5113c1378c1007c8559fcb767593366ba9794397b060535eb80a113db50530fc', file: 'skey.onnx' },
};

export const DEFAULT_CACHE_DIR = join(import.meta.dirname, '..', '.cache', 'models');

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

export const ensureModel = async (id: ModelId, cacheDir = DEFAULT_CACHE_DIR): Promise<string> => {
  const model = MODELS[id];
  const path = join(cacheDir, model.file);
  try {
    if (sha256(await readFile(path)) === model.sha256) return path;
  } catch {
    // not cached yet
  }
  await mkdir(cacheDir, { recursive: true });
  const response = await fetch(model.url);
  if (!response.ok) throw new Error(`Download of ${id} failed: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = sha256(bytes);
  if (actual !== model.sha256) {
    await rm(path, { force: true });
    throw new Error(`SHA-256 mismatch for ${id}: expected ${model.sha256}, got ${actual}`);
  }
  await writeFile(path, bytes);
  return path;
};
