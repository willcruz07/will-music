import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartView } from '../src/components/ChartView.tsx';
import { Player, activeIndexAt } from '../src/components/Player.tsx';

describe('ChartView', () => {
  it('renders chords above lyrics and highlights the active lyric line', () => {
    render(<ChartView chordPro={'{comment: Intro}\n[G] [D]\n[G]Ninguém [D]Deus\nfim'} transpose={0} preferFlats={false} fontSize={16} activeLineIndex={0} />);
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getAllByText('G')[0]).toHaveClass('text-chord');
    expect(screen.getByText('Ninguém').closest('[data-line]')).toHaveAttribute('data-active', 'true');
    expect(screen.getByText('fim').closest('[data-line]')).toHaveAttribute('data-active', 'false');
  });

  it('transposes the rendered chords', () => {
    render(<ChartView chordPro={'[G]Ninguém [D/F#]Deus'} transpose={2} preferFlats={false} fontSize={16} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('E/G#')).toBeInTheDocument();
  });
});

describe('Player', () => {
  it('finds the active index by time', () => {
    expect(activeIndexAt([2, 5, 9], 1)).toBe(-1);
    expect(activeIndexAt([2, 5, 9], 5)).toBe(1);
    expect(activeIndexAt([2, 5, 9], 100)).toBe(2);
    expect(activeIndexAt([], 3)).toBe(-1);
  });

  it('sets playback rate without changing pitch', () => {
    render(<Player src="blob:x" onTime={() => {}} />);
    fireEvent.change(screen.getByLabelText('Velocidade'), { target: { value: '75' } });
    const audio = document.querySelector('audio')!;
    expect(audio.playbackRate).toBe(0.75);
    expect(audio.preservesPitch).toBe(true);
  });
});

describe('ChartView spelling', () => {
  it('spells borrowed chords with flats in the shown key', () => {
    render(<ChartView chordPro={'[C]Santo [A#]Santo'} transpose={0} preferFlats={false} spellKey="C" fontSize={16} />);
    expect(screen.getByText('Bb')).toBeInTheDocument();
  });
});
