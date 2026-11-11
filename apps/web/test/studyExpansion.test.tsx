import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { LESSONS, lessonById, trackLessons } from '../src/study/catalog.ts';
import { notationExample } from '../src/study/notation.ts';
import { note, rest, score } from '../src/study/content/partituras.ts';
import { rhythmEvents, tabEvents } from '../src/study/theory.ts';
import { LessonPage, StudyHome } from '../src/pages/StudyHome.tsx';

vi.mock('../src/components/ScoreView.tsx', () => ({ ScoreView: () => <div>Notação aberta</div> }));

describe('expanded learning paths', () => {
  it('keeps prerequisites real and acyclic and gives both new tracks all four levels', () => {
    const walk = (id: string, path: string[] = []) => {
      expect(path, id).not.toContain(id);
      const lesson = lessonById(id);
      expect(lesson, id).toBeDefined();
      for (const p of lesson!.prerequisites ?? []) walk(p, [...path, id]);
    };
    for (const lesson of LESSONS) walk(lesson.id);
    for (const id of ['cavaquinho', 'partituras'] as const) {
      expect(new Set(trackLessons(id).map(l => l.level)).size).toBe(4);
      for (const l of trackLessons(id)) {
        expect(l.objective).toBeTruthy();
        expect(l.checkpoints?.length).toBeGreaterThan(0);
        expect(l.blocks.some(b => b.kind === 'exercise')).toBe(true);
      }
    }
    const harmony = trackLessons('harmonia').map(l => l.id);
    expect(harmony.indexOf('h-intervalos-base')).toBeLessThan(harmony.indexOf('h-triades'));
  });

  it('validates every written bar, parses XML and checks quizzes against their answer choices', () => {
    for (const lesson of LESSONS) for (const block of lesson.blocks) {
      if (block.kind === 'quiz') {
        expect(block.options[block.answer], lesson.id).toBeTruthy();
        expect(block.explanation, lesson.id).toBeTruthy();
      }
      if (block.kind !== 'notation') continue;
      const { xml, events, duration } = notationExample(block.score);
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      expect(document.querySelector('parsererror'), lesson.id).toBeNull();
      expect(events.length, lesson.id).toBeGreaterThan(0);
      for (const e of events) {
        expect(Number.isFinite(e.time) && e.time >= 0, lesson.id).toBe(true);
        expect(e.time + e.dur, lesson.id).toBeLessThanOrEqual(duration + 0.00001);
      }
    }
  });

  it('uses cavaquinho string pitches rather than guitar pitches', () => {
    const block = lessonById('cv-afinacao')!.blocks.find(b => b.kind === 'tab');
    if (block?.kind !== 'tab') throw new Error('Missing example');
    expect(tabEvents(block.tab, block.bpm, block.tuning).map(e => e.pitch)).toEqual([62, 67, 71, 74]);
  });

  it('shows the new paths in the hub and makes a quiz explanation available after answering', () => {
    const { unmount } = render(<MemoryRouter><StudyHome /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Leitura de partituras/ })).toHaveAttribute('href', '/estudo/trilha/partituras');
    expect(screen.getByRole('link', { name: /^Cavaquinho/ })).toHaveAttribute('href', '/estudo/trilha/cavaquinho');
    unmount();
    render(<MemoryRouter initialEntries={['/estudo/aula/p-pentagrama']}><Routes><Route path="/estudo/aula/:id" element={<LessonPage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Roteiro da aula' })).toHaveTextContent('Localizar Mi');
    const review = within(screen.getByRole('region', { name: 'Revisão da aula' }));
    expect(review.queryByRole('status')).toBeNull();
    fireEvent.click(review.getByRole('button', { name: 'Sol4' }));
    expect(review.getByRole('status')).toHaveTextContent('Isso mesmo');
    expect(screen.queryByText('Notação aberta')).toBeNull();
  });
});

describe('written examples and playback share a timeline', () => {
  it('preserves rests and dotted durations, and ties across a bar create only one attack', () => {
    const { events, xml, duration } = notationExample(score('Duração & ligação', [[rest(), note('D', 4, 'half', { dot: true, tie: 'start' })], [note('D', 4, 'half', { tie: 'stop' }), rest('half')]], { bpm: 60 }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ time: 1, dur: 5, pitch: 62 });
    expect(duration).toBe(8);
    expect(xml).toContain('Duração &amp; ligação');
    expect(xml).toContain('<tied type="start"/>');
    expect(xml).toContain('<tied type="stop"/>');
  });

  it('counts dotted-quarter BPM correctly in 6/8', () => {
    const example = notationExample(score('Composto', [[note('C', 4, 'quarter', { dot: true }), note('D', 4, 'quarter', { dot: true })]], { meter: [6, 8], pulse: 'dotted-quarter', bpm: 60 }));
    expect(example.duration).toBe(2);
    expect(example.events.map(e => e.time)).toEqual([0, 1]);
    expect(example.xml).toContain('<sound tempo="90"/>');
  });

  it('represents triplets, explicit alterations and articulation without shifting attacks', () => {
    const example = notationExample(score('Tercina', [[note('C', 4, 'eighth', { tuplet: true }), note('D', 4, 'eighth', { tuplet: true }), note('E', 4, 'eighth', { tuplet: true }), note('F', 4, 'quarter', { alter: 1, articulation: 'staccato' }), note('G', 4, 'half', { articulation: 'accent' })]], { bpm: 60 }));
    expect(example.events[2]!.time).toBeCloseTo(2 / 3);
    expect(example.events[3]).toMatchObject({ time: 1, dur: 0.45, pitch: 66 });
    expect(example.events[4]!.time).toBe(2);
    expect(example.events[4]!.velocity).toBeGreaterThan(example.events[3]!.velocity!);
    expect(example.xml).toContain('<actual-notes>3</actual-notes>');
    expect(() => notationExample(score('Incompleto', [[note('C')]]))).toThrow(/esperado 4/);
  });

  it('keeps parallel parts simultaneous and makes ghost notes quieter than ordinary hits and accents', () => {
    const s = score('Duas linhas', [[note('C', 4, 'whole')]], { bpm: 60 });
    s.parts.push({ name: 'Baixo', clef: 'bass', measures: [[note('C', 3, 'whole')]] });
    expect(notationExample(s).events.map(e => e.time)).toEqual([0, 0]);
    const hits = rhythmEvents({ bpm: 60, steps: 3, tracks: [{ sound: 'snare', pattern: 'Xxo' }] });
    expect(hits.map(h => h.time)).toEqual([0, 0.25, 0.5]);
    expect(hits[0]!.velocity).toBeGreaterThan(hits[1]!.velocity!);
    expect(hits[1]!.velocity).toBeGreaterThan(hits[2]!.velocity!);
  });
});
