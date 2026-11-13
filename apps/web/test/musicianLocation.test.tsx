import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MusicianLocationFields } from '../src/components/MusicianLocationFields.tsx';
import { BRAZIL_STATES, validateProfileLocation } from '../src/lib/brazilLocations.ts';
import { choose } from './choose.ts';
const Harness = () => {
  const [location, setLocation] = useState({ country: '', region: '', city: '' });
  return <><MusicianLocationFields value={location} onChange={setLocation} /><output data-testid="location">{JSON.stringify(location)}</output></>;
};
describe('state and city profile sheets', () => {
  it('uses a complete local snapshot and validates matching municipalities', () => {
    expect(BRAZIL_STATES).toHaveLength(27);
    expect(BRAZIL_STATES.reduce((total, state) => total + state.cities.length, 0)).toBeGreaterThan(5500);
    expect(validateProfileLocation({ country: 'Brazil', region: 'sao paulo', city: 'sao paulo' })).toEqual({ country: 'Brasil', region: 'SP', city: 'São Paulo' });
    expect(() => validateProfileLocation({ country: 'Brasil', region: 'RJ', city: 'São Paulo' })).toThrow('cidade da lista');
    expect(() => validateProfileLocation({ country: 'Brasil', region: '', city: 'São Paulo' })).toThrow('estado válido');
    expect(validateProfileLocation({ country: 'Portugal', region: 'Lisboa', city: 'Lisboa' })).toEqual({ country: 'Portugal', region: 'Lisboa', city: 'Lisboa' });
  });
  it('selects by sheet, searches without accents and clears the city on state changes', async () => {
    render(<Harness />);
    expect(screen.getByLabelText('Cidade')).toBeDisabled();
    await choose('Estado', 'São Paulo (SP)');
    await userEvent.click(screen.getByLabelText('Cidade'));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar em Cidades de São Paulo' }), 'sao paulo');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.click(screen.getByRole('option', { name: 'São Paulo' }));
    expect(screen.getByTestId('location')).toHaveTextContent('"city":"São Paulo"');
    await choose('Estado', 'Rio de Janeiro (RJ)');
    expect(screen.getByTestId('location')).toHaveTextContent('"city":""');
    expect(screen.getByLabelText('Cidade')).toHaveTextContent('Selecione uma cidade');
    await userEvent.click(screen.getByLabelText('Cidade'));
    await userEvent.type(screen.getByRole('searchbox'), 'cidade que nao existe');
    expect(screen.getByText('Nenhum resultado para essa busca.')).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
  });
});
