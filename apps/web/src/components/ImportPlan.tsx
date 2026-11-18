import { Download, FileText, Grid2X2, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { MODELS } from '@will-music/engine';
import { CHORD_MODELS, listCachedModels } from '../lib/models.ts';
import { hasUsableWebGpu } from '../lib/stems.ts';
import { formatBytes } from '../lib/storage.ts';
import { isMobileStudio, MOBILE_MODELS_NOTICE } from '../lib/studioDevice.ts';
import { WHISPER_BYTES, detectWhisperDevice, whisperCacheReady } from '../lib/whisperModel.ts';

type Plan = { webgpu: boolean; download: number };

const Row = ({ icon, title, text }: { icon: ReactNode; title: string; text: string }) => (
  <li className="flex gap-3">
    <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
    <span><span className="block text-sm font-semibold">{title}</span><span className="block text-sm text-muted-foreground">{text}</span></span>
  </li>
);

/** What the studio will do with this song on this device, and how much the first run downloads. */
export const ImportPlan = () => {
  const mobile = isMobileStudio();
  const [plan, setPlan] = useState<Plan | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
      const webgpu = !mobile && await hasUsableWebGpu(gpu);
      const cached = new Set((await listCachedModels().catch(() => [])).map((m) => m.id));
      const wanted = [...CHORD_MODELS, ...(webgpu ? (['demucs6s'] as const) : [])];
      let download = wanted.filter((id) => !cached.has(id)).reduce((n, id) => n + MODELS[id].bytes, 0);
      if (!mobile) {
        const device = await detectWhisperDevice();
        if (!(await whisperCacheReady(device).catch(() => false))) download += WHISPER_BYTES[device];
      }
      if (active) setPlan({ webgpu, download });
    })();
    return () => { active = false; };
  }, [mobile]);

  return (
    <div className="progress-fade rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold">O que acontece ao analisar</p>
      <ol className="mt-3 space-y-3">
        <Row icon={<Grid2X2 className="size-4" />} title="1. Acordes e tom" text="Primeira etapa a terminar: a cifra já aparece enquanto o resto continua." />
        {mobile
          ? <Row icon={<FileText className="size-4" />} title="2. Letra" text="Buscada no LRCLIB pelo nome da música e do artista." />
          : <>
            <Row icon={<SlidersHorizontal className="size-4" />} title="2. Faixas" text={plan && !plan.webgpu ? 'Indisponível neste navegador (precisa de WebGPU, no Chrome ou Edge atualizados). A análise segue com o áudio original.' : 'Voz, bateria, baixo, guitarra, piano e outros, separados na placa de vídeo.'} />
            <Row icon={<FileText className="size-4" />} title="3. Letra" text="Buscada no LRCLIB e sincronizada com a voz separada; sem texto encontrado, é transcrita." />
          </>}
      </ol>
      {plan && plan.download > 0 && <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground"><Download className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Primeira vez neste aparelho: cerca de {formatBytes(plan.download)} de modelos serão baixados, só uma vez.</p>}
      {mobile && <p className="mt-3 text-xs text-muted-foreground">{MOBILE_MODELS_NOTICE}</p>}
    </div>
  );
};
