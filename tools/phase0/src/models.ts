import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MODELS, type ModelId } from '@will-music/engine';

export { MODELS, type ModelId };

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
