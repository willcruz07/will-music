import type { PublicationMode, useCatalogPublication } from '../lib/useCatalogPublication.ts';

const LABELS: Record<PublicationMode, { title: string; hint: string }> = {
  local: { title: 'Só na minha biblioteca', hint: 'A cifra do catálogo continua como está. Funciona offline.' },
  option: { title: 'Enviar como opção para a comunidade', hint: 'Vira mais uma opção desta música, com o seu nome, para outras pessoas avaliarem e salvarem. A cifra principal não muda.' },
  main: { title: 'Corrigir a minha cifra publicada', hint: 'Você publicou esta cifra e ainda não há opções de outras pessoas.' },
  public: { title: 'Publicar no catálogo', hint: 'A cifra fica disponível para todos, com o seu nome, e pode receber estrelas e opções da comunidade.' },
};

/** Where the edited chart is saved: the personal library, or a community contribution to the catalog. */
export const CatalogPublication = ({ value, disabled }: { value: ReturnType<typeof useCatalogPublication>; disabled?: boolean }) => !value.applicable ? null : (
  <fieldset className="rounded-xl border border-border bg-surface p-3" disabled={disabled}>
    <legend className="px-1 text-sm font-semibold">Onde salvar</legend>
    <div className="space-y-2">
      {value.choices.map(choice => (
        <label key={choice} className="flex items-start gap-2 text-sm">
          <input type="radio" name="catalog-publication" checked={value.mode === choice} onChange={() => value.setMode(choice)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
          <span>{LABELS[choice].title}<span className="mt-0.5 block text-xs text-muted-foreground">{LABELS[choice].hint}</span></span>
        </label>
      ))}
    </div>
    {value.mode === 'public' && (
      <label className="mt-3 block text-sm">Estilo
        <input value={value.style} onChange={e => value.setStyle(e.target.value)} maxLength={60} placeholder="Ex.: Gospel, Sertanejo, MPB" className="mt-1 block min-h-10 w-full rounded-lg border border-border bg-background px-3" />
      </label>
    )}
    {value.mode !== 'local' && value.error && <p role="alert" className="mt-2 text-xs text-danger">{value.error}</p>}
  </fieldset>
);
