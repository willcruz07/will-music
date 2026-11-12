import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MicPage } from '../src/pages/MicPage.tsx';
import { openMic } from '../src/lib/mic.ts';

vi.mock('../src/lib/mic.ts', () => ({ openMic: vi.fn(), tapSamples: vi.fn() }));
vi.mock('../src/study/widgets.tsx', async original => ({ ...(await original<typeof import('../src/study/widgets.tsx')>()), useStudySynth: () => ({ play: vi.fn(), stop: vi.fn(), playing: null }) }));

const capture = () => {
  const track = new EventTarget();
  const context = Object.assign(new EventTarget(), { sampleRate: 48000, state: 'running', createAnalyser: () => ({ fftSize: 4096, getFloatTimeDomainData: (data: Float32Array) => data.fill(0) }) });
  const onState = vi.spyOn(context, 'addEventListener');
  return { context, track, onState, source: { connect: vi.fn(), disconnect: vi.fn() }, stream: { getAudioTracks: () => [track] }, close: vi.fn() };
};

beforeEach(() => { vi.mocked(openMic).mockReset(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });

describe('microphone lifecycle and controls', () => {
  it('provides manual string selection and a vocal target without requesting permission on entry', () => {
    render(<MicPage />);
    fireEvent.click(screen.getByRole('button', { name: '6ª · E2' }));
    expect(screen.getByRole('button', { name: '6ª · E2' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Automático' }));
    expect(screen.getByRole('button', { name: 'Automático' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Voz' }));
    expect(screen.getByRole('region', { name: 'Prática de afinação vocal' })).toBeInTheDocument();
    expect(screen.getByText(/Alvo: C4/)).toBeInTheDocument();
    expect(openMic).not.toHaveBeenCalled();
  });

  it('releases a permission request that finishes after the page becomes hidden', async () => {
    const mic = capture();
    let resolve!: (value: Awaited<ReturnType<typeof openMic>>) => void;
    vi.mocked(openMic).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<MicPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ligar microfone' }));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    fireEvent(document, new Event('visibilitychange'));
    await act(async () => { resolve(mic as unknown as Awaited<ReturnType<typeof openMic>>); });
    expect(mic.close).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ligar microfone' })).toBeEnabled();
    expect(screen.getByText(/Microfone pausado/)).toBeInTheDocument();
  });

  it('stops when the track ends and can start a new capture', async () => {
    const mic = capture();
    vi.mocked(openMic).mockResolvedValue(mic as unknown as Awaited<ReturnType<typeof openMic>>);
    render(<MicPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ligar microfone' }));
    await screen.findByRole('button', { name: 'Desligar' });
    await waitFor(() => expect(mic.onState).toHaveBeenCalledWith('statechange', expect.any(Function)));
    act(() => { mic.track.dispatchEvent(new Event('ended')); });
    await waitFor(() => expect(mic.close).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/captura foi interrompida/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ligar microfone' })).toBeEnabled();
  });

  it('closes the active capture on unmount and pagehide even before document.hidden changes', async () => {
    const mic = capture();
    vi.mocked(openMic).mockResolvedValue(mic as unknown as Awaited<ReturnType<typeof openMic>>);
    const { unmount } = render(<MicPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ligar microfone' }));
    await screen.findByRole('button', { name: 'Desligar' });
    fireEvent(window, new Event('pagehide'));
    expect(mic.close).toHaveBeenCalledTimes(1);
    unmount();
    expect(mic.close).toHaveBeenCalledTimes(1);
  });
});
