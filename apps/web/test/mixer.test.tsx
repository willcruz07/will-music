import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
    expect(driftCorrections(10, [10.01, 10.2, 9.9])).toEqual([null, 10, 10]);
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
