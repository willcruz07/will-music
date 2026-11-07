import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { StudyPage } from '../src/pages/StudyPage.tsx';
import { LessonPage, StudyHome, TrackPage } from '../src/pages/StudyHome.tsx';
import { trackLessons } from '../src/study/catalog.ts';
import { IntervalTrainer } from '../src/study/tools.tsx';
import { choose } from './choose.ts';

const Where = () => <output data-testid="where">{useLocation().pathname + useLocation().search}</output>;

const open = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/estudo" element={<StudyHome />} />
        <Route path="/estudo/trilha/:id" element={<TrackPage />} />
        <Route path="/estudo/aula/:id" element={<LessonPage />} />
        <Route path="/estudo/ferramentas" element={<StudyPage />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => localStorage.clear());

describe('study hub', () => {
  it('separates the tracks into theory, voice, instruments and styles', () => {
    open('/estudo');
    for (const g of ['Teoria e harmonia', 'Voz', 'Instrumentos', 'Estilos']) expect(screen.getByRole('heading', { name: g })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Harmonia aplicada/ })).toHaveAttribute('href', '/estudo/trilha/harmonia');
    expect(screen.getByRole('link', { name: /Canto/ })).toHaveAttribute('href', '/estudo/trilha/canto');
    expect(screen.getByRole('link', { name: /Ciclo de quintas/ })).toHaveAttribute('href', '/estudo/ferramentas?aba=ciclo');
  });

  it('sends old chord links to the tools page', () => {
    open('/estudo?acorde=Bb7M');
    expect(screen.getByTestId('where')).toHaveTextContent('/estudo/ferramentas?acorde=Bb7M');
    expect(screen.getByRole('region', { name: 'Formação de Bb7M' })).toBeInTheDocument();
  });

  it('offers to continue the last lesson opened', () => {
    localStorage.setItem('wm-study-last', 'h-251');
    open('/estudo');
    expect(screen.getByRole('link', { name: /Continuar.*2-5-1|Continuar.*ii/i })).toHaveAttribute('href', '/estudo/aula/h-251');
  });
});

describe('track page', () => {
  it('lists the lessons by level and shows progress', () => {
    localStorage.setItem('wm-study-done', JSON.stringify(['h-notas']));
    open('/estudo/trilha/harmonia');
    expect(screen.getByRole('heading', { level: 1, name: 'Harmonia aplicada' })).toBeInTheDocument();
    for (const l of ['Iniciante', 'Intermediário', 'Avançado', 'Pro']) expect(screen.getByRole('heading', { name: l })).toBeInTheDocument();
    expect(screen.getByText(`1 de ${trackLessons('harmonia').length} aulas estudadas`)).toBeInTheDocument();
  });

  it('filters by level', async () => {
    open('/estudo/trilha/harmonia');
    await userEvent.click(screen.getByRole('radio', { name: 'Pro' }));
    expect(screen.queryByRole('heading', { name: 'Iniciante' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
  });

  it('explains an unknown track', () => {
    open('/estudo/trilha/xyz');
    expect(screen.getByText(/Trilha não encontrada/)).toBeInTheDocument();
  });
});

describe('lesson page', () => {
  it('shows the lesson, marks it as studied and links to the next one', async () => {
    const [first, second] = trackLessons('harmonia');
    open(`/estudo/aula/${first!.id}`);
    expect(screen.getByRole('heading', { level: 1, name: first!.title })).toBeInTheDocument();
    const mark = screen.getByRole('button', { name: /Marcar como estudada/ });
    await userEvent.click(mark);
    expect(screen.getByRole('button', { name: /Estudada/ })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('wm-study-done')!)).toContain(first!.id);
    expect(localStorage.getItem('wm-study-last')).toBe(first!.id);
    expect(screen.getByRole('link', { name: new RegExp(`Próxima.*${second!.title}`) })).toHaveAttribute('href', `/estudo/aula/${second!.id}`);
  });

  it('shows a progression in the chosen key', async () => {
    open('/estudo/aula/h-251');
    const select = screen.getAllByLabelText('Tom')[0]!;
    await choose(select, 'C');
    expect(screen.getAllByRole('button', { name: 'Como tocar Dm7' }).length).toBeGreaterThan(0);
  });

  it('explains an unknown lesson', () => {
    open('/estudo/aula/nada');
    expect(screen.getByText(/Aula não encontrada/)).toBeInTheDocument();
  });
});

describe('study tools', () => {
  it('opens the tab asked for in the link', () => {
    open('/estudo/ferramentas?aba=ciclo');
    expect(screen.getByRole('tab', { name: 'Ciclo de quintas' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the key signature and relative minor on the circle of fifths', async () => {
    open('/estudo/ferramentas?aba=ciclo');
    await userEvent.click(screen.getByRole('radio', { name: /^A maior/ }));
    expect(screen.getByText('3 sustenidos: F# C# G#')).toBeInTheDocument();
    expect(screen.getByText(/F#m \(mesmas notas/)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Campo harmônico de A' })).getByText('G#m7(b5)')).toBeInTheDocument();
  });

  it('lists the progressions catalog', () => {
    open('/estudo/ferramentas?aba=progressoes');
    expect(screen.getByText('ii – V – I')).toBeInTheDocument();
    expect(screen.getByText('Blues de 12 compassos')).toBeInTheDocument();
  });

  it('shows any scale on the fretboard', async () => {
    open('/estudo/ferramentas?aba=braco');
    await choose('Escala', /Hirajoshi/u);
    expect(screen.getByText('C · D · Eb · G · Ab')).toBeInTheDocument();
  });

  it('scores the interval ear training', async () => {
    render(<IntervalTrainer random={() => 0} />);
    // random 0 → first interval of the basic set: minor third
    await userEvent.click(screen.getByRole('button', { name: 'Terça menor' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Certo/);
    expect(screen.getByText('1 de 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Próximo/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Oitava' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Era terça menor/);
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
  });
});

describe('review fixes: tools page follows the link it is sent to', () => {
  it('opens the chord when a link changes ?acorde= while the page is open', async () => {
    const Go = () => {
      const nav = useNavigate();
      return <button type="button" onClick={() => nav('/estudo/ferramentas?acorde=Dm7')}>ir</button>;
    };
    render(
      <MemoryRouter initialEntries={['/estudo/ferramentas?aba=progressoes']}>
        <Routes>
          <Route path="/estudo/ferramentas" element={<><StudyPage /><Go /></>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'ir' }));
    expect(screen.getByRole('tab', { name: 'Acordes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Formação de Dm7' })).toBeInTheDocument();
  });
});
