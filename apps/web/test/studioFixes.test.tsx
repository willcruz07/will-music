import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../src/components/Player.tsx';
import { createManualSong } from '../src/lib/chartEdit.ts';
import { db } from '../src/lib/db.ts';
import { createMixSum } from '../src/lib/exportMix.ts';
import { saveScore } from '../src/lib/score.ts';

const synthSpy = { unlock: vi.fn(), play: vi.fn(), stop: vi.fn(), setEvents: vi.fn(), setVolume: vi.fn(), dispose: vi.fn() };
vi.mock('../src/lib/synth.ts', async (load) => ({ ...(await load<typeof import('../src/lib/synth.ts')>()), createScoreSynth: () => synthSpy }));
vi.mock('../src/components/ScoreView.tsx', () => ({ ScoreView: () => <div data-testid="score" /> }));
const { SongScore } = await import('../src/pages/SongScore.tsx');

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('review fixes: mix export memory', () => {
  it('adds tracks one by one into a running sum and limits the peak at the end', () => {
    const sum = createMixSum();
    sum.add(Float32Array.from([0.5, 0.5]), Float32Array.from([0.5, 0.5]), 1);
    sum.add(Float32Array.from([0.5, 0.5, 0.5]), Float32Array.from([0, 0, 0]), 1);
    const { left, right } = sum.finish();
    expect(left.length).toBe(3);
    expect(left[0]).toBeCloseTo(0.99, 5);
    expect(left[2]).toBeCloseTo(0.495, 5);
    expect(right[0]).toBeCloseTo(0.495, 5);
  });
});

describe('review fixes: loop at the end of the song', () => {
  it('starts the stretch again when the song ends inside the loop', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    render(<Player src="blob:x" onTime={() => {}} />);
    const audio = document.querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { value: 100, configurable: true });
    fireEvent.loadedMetadata(audio);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
    audio.currentTime = 90;
    fireEvent.click(screen.getByRole('button', { name: 'Marcar A' }));
    audio.currentTime = 100;
    fireEvent.click(screen.getByRole('button', { name: 'Marcar B' }));
    fireEvent.ended(audio);
    expect(audio.currentTime).toBe(90);
    expect(play).toHaveBeenCalled();
  });
});

describe('review fixes: resume position', () => {
  it('keeps the saved position when the tracks load before the first file', () => {
    sessionStorage.setItem('wm-pos:s1', '42');
    const { rerender } = render(<Player src="blob:original" songId="s1" onTime={() => {}} />);
    rerender(<Player sources={[{ name: 'instrumental', src: 'blob:a', volume: 1 }]} songId="s1" onTime={() => {}} />);
    const master = document.querySelector('audio')!;
    fireEvent.loadedMetadata(master);
    expect(master.currentTime).toBe(42);
  });

  it('does not wipe the saved position when leaving before the audio loaded', () => {
    sessionStorage.setItem('wm-pos:s2', '42');
    const { unmount } = render(<Player src="blob:x" songId="s2" onTime={() => {}} />);
    unmount();
    expect(sessionStorage.getItem('wm-pos:s2')).toBe('42');
  });
});

describe('review fixes: score sound', () => {
  it('starts the notes right away when switched on during playback (inside the tap)', async () => {
    const song = await createManualSong('Hino', '');
    await db.audio.put({ songId: song.id, blob: new Blob(['x']), mimeType: 'audio/mpeg' });
    await saveScore({ songId: song.id, notes: [{ pitch: 60, start: 0, end: 1, velocity: 1 }], bpm: 100, source: 'mix', model: 'x', createdAt: '' });
    render(
      <MemoryRouter initialEntries={[`/musica/${song.id}/partitura`]}>
        <Routes>
          <Route path="/musica/:id/partitura" element={<SongScore />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId('score');
    const audio = document.querySelector('audio')!;
    Object.defineProperty(audio, 'paused', { value: false, configurable: true });
    audio.currentTime = 12;
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Tocar as notas da partitura junto com a música'));
    });
    expect(synthSpy.unlock).toHaveBeenCalled();
    expect(synthSpy.play).toHaveBeenCalledWith(12, 1);
  });
});
