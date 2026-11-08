import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerControls } from '../src/components/Player.tsx';
import { ScorePlayer, type ScorePlayerHandle } from '../src/components/ScorePlayer.tsx';
import type { ScoreCursor } from '../src/components/ScoreView.tsx';

const synth = { unlock: vi.fn(), setVolume: vi.fn(), setEvents: vi.fn(), play: vi.fn(), stop: vi.fn(), dispose: vi.fn(), position: vi.fn((): number | null => null) };
vi.mock('../src/lib/synth.ts', async (orig) => ({ ...(await orig<typeof import('../src/lib/synth.ts')>()), createScoreSynth: () => synth }));

// 120 BPM, bars from 0 s: a whole note (one 4/4 bar) is 2 s.
const grid = { bpm: 120, origin: 0, tick: 0.125 };
const events = [
  { time: 0, dur: 0.5, pitch: 60 },
  { time: 1, dur: 0.5, pitch: 62 },
  { time: 3, dur: 1, pitch: 64 },
];

const setup = () => {
  const cursor: ScoreCursor = { steps: [0, 0.5, 1.5], moveTo: vi.fn(), hide: vi.fn() };
  const song = { playFrom: vi.fn(), pause: vi.fn(), currentTime: () => 0, playing: () => false, rate: () => 1 } satisfies PlayerControls;
  const refs = { cursor: { current: cursor }, song: { current: song as PlayerControls | null }, handle: { current: null as ScorePlayerHandle | null } };
  const onWithMusic = vi.fn();
  render(<ScorePlayer events={events} grid={grid} skipTicks={0} cursorRef={refs.cursor} songPlayer={refs.song} handle={refs.handle} onWithMusic={onWithMusic} />);
  return { cursor, song, handle: refs.handle, onWithMusic };
};

beforeEach(() => {
  for (const f of Object.values(synth)) f.mockClear();
  synth.position.mockReturnValue(null);
});

describe('score player', () => {
  it('plays the notes alone at its speed, pausing the song player', async () => {
    const { song } = setup();
    await userEvent.selectOptions(screen.getByRole('combobox'), '0.75');
    await userEvent.click(screen.getByRole('button', { name: 'Tocar a partitura' }));
    expect(song.pause).toHaveBeenCalled();
    expect(synth.setEvents).toHaveBeenCalledWith(events);
    expect(synth.play).toHaveBeenCalledWith(0, 0.75);
    expect(screen.getByRole('button', { name: 'Pausar a partitura' })).toBeInTheDocument();
  });

  it('walks the cursor onto the note sounding now', () => {
    const { cursor, handle } = setup();
    act(() => handle.current!.songTime(1.2)); // 0.6 of a bar: the step that starts at 0.5
    expect(cursor.moveTo).toHaveBeenLastCalledWith(1);
    act(() => handle.current!.songTime(3.5));
    expect(cursor.moveTo).toHaveBeenLastCalledWith(2);
    act(() => handle.current!.songTime(0.1));
    expect(cursor.moveTo).toHaveBeenLastCalledWith(0);
  });

  it('"Com a música" plays the song from the cursor, with the notes on', async () => {
    const { song, handle, onWithMusic } = setup();
    act(() => handle.current!.songTime(1));
    await userEvent.click(screen.getByRole('radio', { name: 'Com a música' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tocar a partitura' }));
    expect(onWithMusic).toHaveBeenCalled();
    expect(song.playFrom).toHaveBeenCalledWith(1);
    expect(synth.play).not.toHaveBeenCalled();
    act(() => handle.current!.songTransport(false));
    expect(screen.getByRole('button', { name: 'Tocar a partitura' })).toBeInTheDocument();
  });

  it('stops playing alone when the song player below starts', async () => {
    const { handle } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Tocar a partitura' }));
    act(() => handle.current!.songTransport(false)); // its own pause of the song: ignored
    expect(screen.getByRole('button', { name: 'Pausar a partitura' })).toBeInTheDocument();
    act(() => handle.current!.songTransport(true));
    expect(synth.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tocar a partitura' })).toBeInTheDocument();
  });

  it('shows the length of the part', () => {
    setup();
    expect(screen.getByText('0:04')).toBeInTheDocument();
  });
});
