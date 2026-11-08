import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LyricsSkeleton, TranscribingBar, formatElapsed } from '../src/components/AnalysisProgress.tsx';

afterEach(() => vi.useRealTimers());

describe('feedback while the lyrics are transcribed', () => {
  it('formats the elapsed time', () => {
    expect(formatElapsed(9_400)).toBe('9 s');
    expect(formatElapsed(65_000)).toBe('1 min 05 s');
  });

  it('shows the step, the latest words and a running clock', () => {
    vi.useFakeTimers();
    render(<TranscribingBar progress={{ label: 'Transcrevendo a letra: trecho 2 de 9', fraction: 1 / 9, detail: '“…ninguém explica”', lyricsPending: true }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Transcrevendo a letra: trecho 2 de 9');
    expect(screen.getByText(/Ouvindo: “…ninguém explica”/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByLabelText('Tempo: 3 s')).toBeInTheDocument();
  });

  it('says the chords are ready while nothing has been heard yet', () => {
    render(<TranscribingBar progress={{ label: 'Preparando o modelo da letra', lyricsPending: true }} />);
    expect(screen.getByText(/acordes já estão prontos/)).toBeInTheDocument();
  });

  it('draws placeholder lyric lines', () => {
    const { container } = render(<LyricsSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(4);
  });
});
