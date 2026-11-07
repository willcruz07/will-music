import { fireEvent, render, screen } from '@testing-library/react';
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
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
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

describe('player drawer', () => {
  it('starts collapsed with play and position, and opens the practice controls', () => {
    render(<Player src="blob:x" title="Hino" onTime={() => {}} onAutoScrollChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Tocar' })).toBeInTheDocument();
    expect(screen.getByText('Hino')).toBeInTheDocument();
    expect(screen.queryByLabelText('Velocidade')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
    expect(screen.getByLabelText('Velocidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Rolagem automática')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '75%' }));
    expect(document.querySelector('audio')!.playbackRate).toBe(0.75);
    expect(screen.getByRole('button', { name: 'Fechar controles' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('reports play, pause and speed to followers like the score synth', () => {
    const seen: { playing: boolean; rate: number }[] = [];
    render(<Player src="blob:x" onTime={() => {}} onTransport={(t) => seen.push({ playing: t.playing, rate: t.rate })} />);
    const audio = document.querySelector('audio')!;
    fireEvent.playing(audio);
    fireEvent.pause(audio);
    expect(seen).toEqual([
      { playing: true, rate: 1 },
      { playing: false, rate: 1 },
    ]);
  });

  it('shows steady-scroll speed only for the steady mode', () => {
    const modes: string[] = [];
    const { rerender } = render(<Player src="blob:x" onTime={() => {}} onAutoScrollChange={() => {}} scrollMode="follow" onScrollModeChange={(m) => modes.push(m)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
    expect(screen.queryByLabelText('Velocidade da rolagem')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Rolagem contínua' }));
    expect(modes).toEqual(['steady']);
    rerender(<Player src="blob:x" onTime={() => {}} onAutoScrollChange={() => {}} scrollMode="steady" onScrollModeChange={() => {}} scrollSpeed={5} />);
    expect(screen.getByLabelText('Velocidade da rolagem')).toHaveValue('5');
  });
});
