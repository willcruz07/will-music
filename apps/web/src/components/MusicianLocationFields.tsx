import { SheetSelect } from '../ui/SheetSelect.tsx';
import { BRAZIL_STATES, findBrazilState, isBrazil, type ProfileLocation } from '../lib/brazilLocations.ts';

const fieldClass = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-base';
export const MusicianLocationFields = ({ value, onChange }: { value: ProfileLocation; onChange: (location: ProfileLocation) => void }) => {
  const brazil = isBrazil(value.country);
  const state = findBrazilState(value.region);
  return <>
    <div className="grid min-w-0 gap-4 sm:grid-cols-3">
      <label className="min-w-0 text-sm font-semibold">País<input autoComplete="country-name" maxLength={60} placeholder="Brasil" value={value.country} onChange={event => { const country = event.target.value; onChange(isBrazil(country) === brazil ? { ...value, country } : { country, region: '', city: '' }); }} className={fieldClass} /></label>
      {brazil ? <>
        <div className="min-w-0"><p className="text-sm font-semibold">Estado</p><SheetSelect label="Estado" title="Escolha seu estado" value={state?.code || ''} options={[{ value: '', label: 'Não informar' }, ...BRAZIL_STATES.map(item => ({ value: item.code, label: `${item.name} (${item.code})` }))]} onChange={region => onChange({ country: 'Brasil', region, city: '' })} searchable className="mt-2 min-h-11 w-full" renderValue={option => state ? option?.label : value.region ? `${value.region} · confirme` : 'Selecione um estado'} /></div>
        <div className="min-w-0"><p className="text-sm font-semibold">Cidade</p><SheetSelect label="Cidade" title={state ? `Cidades de ${state.name}` : 'Escolha sua cidade'} disabled={!state} searchable value={value.city} options={[{ value: '', label: 'Não informar' }, ...(state?.cities || []).map(city => ({ value: city, label: city }))]} onChange={city => onChange({ country: 'Brasil', region: state!.code, city })} className="mt-2 min-h-11 w-full" renderValue={option => value.city ? option?.label || `${value.city} · confirme` : state ? 'Selecione uma cidade' : 'Escolha o estado primeiro'} /></div>
      </> : <>
        <label className="min-w-0 text-sm font-semibold">Estado ou região<input autoComplete="address-level1" maxLength={80} value={value.region} onChange={event => onChange({ ...value, region: event.target.value })} className={fieldClass} /></label>
        <label className="min-w-0 text-sm font-semibold">Cidade<input autoComplete="address-level2" maxLength={80} value={value.city} onChange={event => onChange({ ...value, city: event.target.value })} className={fieldClass} /></label>
      </>}
    </div>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{brazil ? 'Escolha primeiro o estado e depois uma cidade da lista. Você pode buscar pelo nome, mesmo sem acentos. As listas também funcionam offline.' : 'Para o Brasil, estados e cidades são selecionados em listas. Para outros países, informe sua região e cidade.'}</p>
  </>;
};
