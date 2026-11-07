import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeAudio, probeAudio } from '../src/ffmpeg.ts';

const run = (cmd: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

describe('ffmpeg decoding', () => {
  it('decodes a file whose path has unicode characters', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'Ninguém ⧸ Explica ｜ Deus '));
    const file = join(dir, 'tom de teste.wav');
    await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1:sample_rate=48000', '-ac', '2', file]);
    expect(await probeAudio(file)).toMatchObject({ sampleRate: 48000, channels: 2 });
    const { sampleRate, channels } = await decodeAudio(file);
    expect(sampleRate).toBe(48000);
    expect(channels).toHaveLength(2);
    expect(channels[0]!.length).toBeGreaterThan(47000);
    expect(channels[0]!.length).toBe(channels[1]!.length);
  }, 30000);

  it('fails clearly for a missing file', async () => {
    await expect(decodeAudio(join(tmpdir(), 'nao-existe.mp3'))).rejects.toThrow(/ffprobe|ffmpeg/);
  });
});
