import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Player } from '../src/components/Player.tsx';
import { driftCorrections, mixVolumes } from '../src/lib/mixer.ts';

describe('mixer', () => {
  it('solo wins over the rest and mute silences', () => {
    expect(mixVolumes([
      { name: 'instrumental', volume: 1, muted: false, solo: false },
      { name: 'lead', volume: 0.8, muted: false, solo: true },
      { name: 'backing', volume: 1, muted: true, solo: false },
    ])).toEqual({ instrumental: 0, lead: 0.8, backing: 0 });
    expect(mixVolumes([{ name: 'a', volume: 0.5, muted: false, solo: false }, { name: 'b', volume: 1, muted: true, solo: false }])).toEqual({ a: 0.5, b: 0 });
  });

  it('corrects only drifted tracks', () => {
    expect(driftCorrections(10, [10.01, 10.2, 9.9])).toEqual([null, 10, null]);
  });

  it('applies speed and seek to every source', () => {
    render(<Player sources={[{ name: 'instrumental', src: 'blob:a', volume: 1 }, { name: 'lead', src: 'blob:b', volume: 0.5 }]} onTime={() => {}} />);
    const audios = [...document.querySelectorAll('audio')];
    expect(audios).toHaveLength(2);
    expect(audios[1]!.volume).toBe(0.5);
    fireEvent.change(document.querySelector('[aria-label="Velocidade"]')!, { target: { value: '75' } });
    expect(audios.map((a) => [a.playbackRate, a.preservesPitch])).toEqual([[0.75, true], [0.75, true]]);
    audios[0]!.currentTime = 30;
    fireEvent.timeUpdate(audios[0]!);
    expect(audios[1]!.currentTime).toBe(30);
  });
});

describe('review fixes: mixer', () => {
  it('silences with muted (iOS ignores volume) and mirrors pause to followers', () => {
    render(<Player sources={[{ name: 'instrumental', src: 'blob:a', volume: 1 }, { name: 'lead', src: 'blob:b', volume: 0 }]} onTime={() => {}} />);
    const [master, follower] = [...document.querySelectorAll('audio')];
    expect(follower!.muted).toBe(true);
    expect(master!.muted).toBe(false);
    const pause = vi.spyOn(follower!, 'pause').mockImplementation(() => {});
    fireEvent.pause(master!);
    expect(pause).toHaveBeenCalled();
  });

  it('uses a looser drift tolerance to avoid audible seeks', () => {
    expect(driftCorrections(10, [10.1, 10.3])).toEqual([null, 10]);
  });

  it('keeps position and speed when switching between original and tracks', () => {
    const { rerender } = render(<Player src="blob:original" onTime={() => {}} />);
    const master = document.querySelector('audio')!;
    fireEvent.change(document.querySelector('[aria-label="Velocidade"]')!, { target: { value: '80' } });
    master.currentTime = 42;
    fireEvent.timeUpdate(master);
    rerender(<Player sources={[{ name: 'instrumental', src: 'blob:a', volume: 1 }, { name: 'lead', src: 'blob:b', volume: 1 }]} onTime={() => {}} />);
    const audios = [...document.querySelectorAll('audio')];
    audios[0]!.currentTime = 0;
    fireEvent.loadedMetadata(audios[0]!);
    expect(audios.map((a) => a.currentTime)).toEqual([42, 42]);
    expect(audios.map((a) => a.playbackRate)).toEqual([0.8, 0.8]);
  });
});
