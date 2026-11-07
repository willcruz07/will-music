import { spawn } from 'node:child_process';

const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe';

// Always spawn with an argument array and no shell: paths with accents, "⧸" or "｜" pass through untouched.
const capture = (cmd: string, args: string[]): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', (error) => reject(new Error(`${cmd} could not start: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exited with ${code}: ${Buffer.concat(err).toString('utf8').trim()}`));
    });
  });

export type AudioInfo = { sampleRate: number; channels: number; duration: number };

export const probeAudio = async (path: string): Promise<AudioInfo> => {
  const json = await capture(FFPROBE, [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=sample_rate,channels:format=duration', '-of', 'json', path,
  ]);
  const parsed = JSON.parse(json.toString('utf8')) as {
    streams?: { sample_rate?: string; channels?: number }[];
    format?: { duration?: string };
  };
  const stream = parsed.streams?.[0];
  if (!stream?.sample_rate || !stream.channels) throw new Error(`ffprobe found no audio stream in ${path}`);
  return { sampleRate: Number(stream.sample_rate), channels: stream.channels, duration: Number(parsed.format?.duration ?? 0) };
};

export const decodeAudio = async (path: string): Promise<{ sampleRate: number; channels: Float32Array[] }> => {
  const info = await probeAudio(path);
  const raw = await capture(FFMPEG, ['-v', 'error', '-i', path, '-map', '0:a:0', '-f', 'f32le', '-acodec', 'pcm_f32le', '-']);
  const usable = raw.byteLength - (raw.byteLength % 4);
  const interleaved = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + usable));
  const frames = Math.floor(interleaved.length / info.channels);
  const channels = Array.from({ length: info.channels }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < info.channels; c++) channels[c]![i] = interleaved[i * info.channels + c]!;
  }
  return { sampleRate: info.sampleRate, channels };
};
