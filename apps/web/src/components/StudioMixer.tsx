import { useEffect, useState } from 'react';
import { computePeaks } from '@will-music/engine';
import type { StemsState } from '../lib/useStems.ts';
import { Mixer } from './Mixer.tsx';
import { Waveform } from './player/Waveform.tsx';

/** Decode waveforms sequentially and only while Tracks is open; no extra IndexedDB writes. */
export const StudioMixer = ({ stems, onSeek, getTime }: { stems: StemsState; onSeek: (time: number) => void; getTime: () => number }) => {
  const [waves, setWaves] = useState<Record<string, { peaks: Float32Array; duration: number }>>({});
  const [time, setTime] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTime(getTime()), 250);
    return () => window.clearInterval(timer);
  }, [getTime]);
  useEffect(() => {
    let cancelled = false;
    setWaves({});
    void (async () => {
      for (const track of stems.tracks ?? []) {
        if (cancelled) break;
        const context = new OfflineAudioContext(1, 1, 8000);
        const audio = await context.decodeAudioData(await track.blob.arrayBuffer());
        if (cancelled) break;
        const record = { peaks: computePeaks(audio.getChannelData(0), 600), duration: audio.duration };
        setWaves(previous => ({ ...previous, [track.name]: record }));
      }
    })().catch(() => { /* Waveform is optional: mixer and audio still work. */ });
    return () => { cancelled = true; };
  }, [stems.tracks]);
  return <Mixer tracks={stems.mix} onChange={stems.setMix} renderWave={name => {
    const wave = waves[name];
    return wave ? <Waveform peaks={wave.peaks} duration={wave.duration} time={time} loop={null} onSeek={onSeek} onSelect={onSeek} /> : <div aria-label="Preparando onda da faixa" className="h-20 animate-pulse rounded-lg bg-muted" />;
  }} />;
};
