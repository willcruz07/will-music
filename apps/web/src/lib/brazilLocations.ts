import { BRAZIL_STATES } from './brazilLocationsData.ts';
export { BRAZIL_STATES };
const fold = (value: string) => value.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
export const isBrazil = (country: string) => ['', 'brasil', 'brazil', 'br'].includes(fold(country));
export const findBrazilState = (region: string) => BRAZIL_STATES.find(state => fold(state.code) === fold(region) || fold(state.name) === fold(region));
export type ProfileLocation = { city: string; region: string; country: string };
export const validateProfileLocation = (location: ProfileLocation): ProfileLocation => {
  const result = { city: location.city.trim(), region: location.region.trim(), country: location.country.trim() };
  if (!isBrazil(result.country) || (!result.region && !result.city)) return result;
  const state = findBrazilState(result.region);
  if (!state) throw new Error('Selecione um estado válido para sua localização.');
  const city = result.city ? state.cities.find(name => fold(name) === fold(result.city)) : '';
  if (city === undefined) throw new Error('Selecione uma cidade da lista do estado escolhido.');
  return { country: 'Brasil', region: state.code, city };
};
