import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const fixtureBytes = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))));

export const f32 = (values: number[]): Float32Array => Float32Array.from(values);

export const sine = (freq: number, amp: number, rate: number, seconds: number): Float32Array => {
  const n = Math.round(rate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
};

export const rms = (x: Float32Array): number => {
  let s = 0;
  for (const v of x) s += v * v;
  return Math.sqrt(s / x.length);
};

export const dominantFrequency = (x: Float32Array, rate: number): number => {
  let crossings = 0;
  for (let i = 1; i < x.length; i++) if ((x[i - 1]! < 0) !== (x[i]! < 0)) crossings++;
  return (crossings / 2) * (rate / x.length);
};
