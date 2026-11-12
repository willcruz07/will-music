import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChartView } from '../src/components/ChartView.tsx';
import { Player, activeIndexAt } from '../src/components/Player.tsx';
import { lyricWords } from '../src/lib/chartWords.ts';
import { chordNotes } from '../src/lib/chordNotation.ts';

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

  it('wraps at words without breaking the syllables of a word at a chord change', () => {
    const parts = [{ chord: 'C', text: 'Ama' }, { chord: 'G', text: 'nhã será ' }, { chord: 'F', text: 'outro dia' }];
    const words = lyricWords(parts);
    expect(words.map(word => word.kind === 'space' ? word.text : word.pieces.map(p => p.text).join('')).join('')).toBe('Amanhã será outro dia');
    expect(words[0]).toMatchObject({ kind: 'word', pieces: [{ text: 'Ama', offset: 0, chord: 'C' }, { text: 'nhã', offset: 3, chord: 'G' }] });
    render(<ChartView chordPro="[C]Ama[G]nhã será [F]outro dia" transpose={0} preferFlats={false} fontSize={16} />);
    expect(screen.getByText('Ama').closest('[data-chart-word]')).toBe(screen.getByText('nhã').closest('[data-chart-word]'));
    expect(screen.getByText('outro').closest('[data-chart-word]')).not.toBe(screen.getByText('dia').closest('[data-chart-word]'));
  });

  it('transposes grouped labels separately and recognizes numeric slash extensions for diagrams', () => {
    render(<ChartView chordPro="[C G/B]Texto [C6/9]aqui" transpose={2} preferFlats={false} fontSize={16} onChordTap={() => {}} />);
    expect(screen.getByRole('button', { name: 'Como tocar D' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Como tocar A/C#' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Como tocar D6/9' })).toBeInTheDocument();
    expect(chordNotes('C6/9')).toEqual(chordNotes('C6(9)'));
    expect(chordNotes('G7/9/B')).toEqual(chordNotes('G7(9)/B'));
    expect(chordNotes('B♭m7')).toEqual(chordNotes('Bbm7'));
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
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
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

describe('ChartView picking', () => {
  it('reports the lyric line and plain character of a tapped word', () => {
    const picks: [number, number][] = [];
    render(<ChartView chordPro={'{comment: Intro}\n[G]Ninguém explica\num [D]dois'} transpose={0} preferFlats={false} fontSize={16} onPick={(l, c) => picks.push([l, c])} />);
    fireEvent.click(screen.getByText('explica'));
    fireEvent.click(screen.getByText('dois'));
    expect(picks).toEqual([[0, 8], [1, 3]]);
  });
});

describe('Player loop', () => {
  it('jumps back to A after passing B', () => {
    render(<Player src="blob:x" onTime={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir controles' }));
    const audio = document.querySelector('audio')!;
    Object.defineProperty(audio, 'duration', { value: 100, configurable: true });
    fireEvent.loadedMetadata(audio);
    audio.currentTime = 5;
    fireEvent.click(screen.getByRole('button', { name: 'Marcar A' }));
    audio.currentTime = 12;
    fireEvent.click(screen.getByRole('button', { name: 'Marcar B' }));
    expect(screen.getByText(/Loop 0:05–0:12/)).toBeInTheDocument();
    audio.currentTime = 12.3;
    fireEvent.timeUpdate(audio);
    expect(audio.currentTime).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar loop' }));
    audio.currentTime = 50;
    fireEvent.timeUpdate(audio);
    expect(audio.currentTime).toBe(50);
  });
});
