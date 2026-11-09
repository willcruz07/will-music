import { useEffect, useState } from 'react';
import { requestPersistence, storageStatus } from '../lib/storage.ts';
import { Button } from '../ui/Button.tsx';

/** Persistence protects saved data from automatic eviction; it does not reserve disk space or memory. */
export const StorageProtection = () => {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supported = typeof navigator !== 'undefined' && typeof navigator.storage?.persist === 'function';

  useEffect(() => {
    let alive = true;
    void storageStatus().then((status) => { if (alive) setPersisted(status.persisted); });
    return () => { alive = false; };
  }, []);

  const protect = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const granted = await requestPersistence();
      const status = await storageStatus();
      setPersisted(granted || status.persisted);
      setMessage(granted || status.persisted
        ? 'Proteção concedida pelo navegador.'
        : 'O navegador não concedeu a proteção desta vez. Você pode continuar usando o app; mantenha um backup das suas músicas.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
      <p className="font-semibold">{persisted === null ? 'Consultando proteção dos dados…' : persisted ? 'Armazenamento persistente ativado' : 'Armazenamento persistente não concedido'}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {persisted ? 'Protege os dados salvos contra limpeza automática por pressão de armazenamento. Você ainda pode removê-los ao limpar os dados do site.' : 'Sem essa proteção, o navegador pode remover dados locais automaticamente. Exporte um backup para preservar seu repertório.'}
        {' '}Essa proteção não aumenta o espaço disponível nem a memória para separar faixas.
      </p>
      {!persisted && supported && (
        <Button variant="outline" className="mt-2" disabled={requesting || persisted === null} onClick={() => void protect()}>
          {requesting ? 'Solicitando proteção…' : 'Solicitar proteção dos dados'}
        </Button>
      )}
      {!supported && <p className="mt-2 text-xs text-muted-foreground">Este navegador não disponibiliza a solicitação de persistência.</p>}
      {message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
};
