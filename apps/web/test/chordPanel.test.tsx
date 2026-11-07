import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChordDiagram } from '../src/components/ChordDiagram.tsx';
import { chartChords } from '../src/components/ChordPanel.tsx';

describe('chord panel', () => {
  it('lists distinct chords in order, transposed and spelled', () => {
    expect(chartChords('{comment: Intro}\n[C] [G]\n[C]Santo [A#]Santo [G]Santo', 0, 'C')).toEqual(['C', 'G', 'Bb']);
    expect(chartChords('[G]x [D/F#]y', 2, 'A')).toEqual(['A', 'E/G#']);
  });

  it('draws a keyboard with the chord notes and a message for unknown chords', () => {
    const { container } = render(<ChordDiagram chord="C" instrument="teclado" />);
    expect(container.querySelectorAll('rect[fill="var(--chord)"]')).toHaveLength(3);
    render(<ChordDiagram chord="Xyz" instrument="teclado" />);
    expect(screen.getByText('Sem diagrama para Xyz')).toBeInTheDocument();
  });
});

describe('review fixes: diagram', () => {
  it('recovers after an unknown chord when the next one is known', async () => {
    const { rerender, findByText, queryByText } = render(<ChordDiagram chord="Xyz" instrument="violao" />);
    expect(await findByText('Sem diagrama para Xyz')).toBeInTheDocument();
    rerender(<ChordDiagram chord="C" instrument="violao" />);
    await new Promise((r) => setTimeout(r, 200));
    expect(queryByText(/Sem diagrama/)).toBeNull();
  });
});
