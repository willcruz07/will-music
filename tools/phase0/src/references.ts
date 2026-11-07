import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type KeyMode, parseReferenceChord } from '@will-music/engine';

export type Reference = {
  id: string;
  title: string;
  artist: string;
  /** Relative to WILL_MUSIC_AUDIO_DIR. */
  audio: string;
  key: { root: string; mode: KeyMode };
  status: 'draft' | 'confirmed';
  /** Linear chord sequence of the recording, repeats expanded, Brazilian notation. */
  sequence: string[];
  notes?: string;
};

export const DEFAULT_REFERENCES_DIR = join(import.meta.dirname, '..', '..', '..', 'docs', 'fase0', 'referencias');

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export const loadReferences = async (dir = DEFAULT_REFERENCES_DIR): Promise<Reference[]> => {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const references: Reference[] = [];
  for (const file of files) {
    const ref = JSON.parse(await readFile(join(dir, file), 'utf8')) as Reference;
    const fail = (msg: string): never => {
      throw new Error(`${file}: ${msg}`);
    };
    if (![ref.id, ref.title, ref.artist, ref.audio, ref.key?.root].every(isString)) fail('missing id/title/artist/audio/key.root');
    if (ref.key.mode !== 'major' && ref.key.mode !== 'minor') fail('key.mode must be major or minor');
    if (ref.status !== 'draft' && ref.status !== 'confirmed') fail('status must be draft or confirmed');
    if (!Array.isArray(ref.sequence) || ref.sequence.length === 0) fail('sequence must be a non-empty list');
    for (const chord of ref.sequence) {
      try {
        parseReferenceChord(chord);
      } catch {
        fail(`cannot parse chord "${chord}"`);
      }
    }
    references.push(ref);
  }
  return references;
};
