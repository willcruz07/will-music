import { describe, expect, it } from 'vitest';
import { TUNINGS, median, tunerReading } from '../src/lib/tuner.ts';

const guitar = TUNINGS.find((t) => t.id === 'guitar')!;
const chromatic = TUNINGS[0]!;

describe('tuner', () => {
  it('points at the nearest guitar string and says how far it is', () => {
    const r = tunerReading(82.41, guitar);
    expect(r.target).toEqual({ string: 6, name: 'E2' });
    expect(r.inTune).toBe(true);
    const flat = tunerReading(108, guitar); // A string tuned low
    expect(flat.target!.string).toBe(5);
    expect(flat.cents).toBeLessThan(-30);
    expect(flat.inTune).toBe(false);
  });

  it('works as a chromatic tuner with another reference pitch', () => {
    expect(tunerReading(440, chromatic)).toMatchObject({ note: 'A', solfege: 'Lá', octave: 4, cents: 0, inTune: true });
    expect(tunerReading(432, chromatic, 432).cents).toBe(0);
  });

  it('takes the median of recent readings', () => {
    expect(median([1, 100, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('microphone page', () => {
  it('explains when the browser gives no microphone', async () => {
    const { render, screen } = await import('@testing-library/react');
    const userEvent = (await import('@testing-library/user-event')).default;
    const { MicPage } = await import('../src/pages/MicPage.tsx');
    render(<MicPage />);
    expect(screen.getByRole('tab', { name: 'Afinador' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: /Ligar microfone/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/não dá acesso ao microfone/);
  });
});
