# Separação de faixas, mixer e Whisper — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar a música em **instrumental, voz principal e backing vocals** no navegador (WebGPU), tocar as faixas num mixer com volume, mudo e solo, mantendo velocidade e loop, e **transcrever a letra do áudio com o Whisper** quando o LRCLIB não tiver a música.

**Architecture:** O DSP fica no engine, em CPU e testável em Node; a inferência fica no worker com `onnxruntime-web/webgpu`.
- **STFT/iSTFT:** porte exato dos shaders `frame` / `pack` / `applyMasks` / `overlapAdd` do Musetric (Hann, n_fft 2048, hop 441, 1100 quadros, padding por reflexão de n_fft/2).
- **Blocos:** a música é dividida em blocos de `441 × 1099` amostras, com 25% de sobreposição e crossfade linear.
- **Modelo:** `musetric/mel-band-roformer-duality-kara2-student-onnx` (Apache-2.0) devolve duas máscaras encadeadas, voz sobre a mistura e backing sobre a voz:
  - voz = mistura·m1;
  - backing = voz·m2;
  - voz principal = voz − backing;
  - instrumental = mistura − voz.
- **Armazenamento:** as três faixas finais são gravadas como WAV 16 bits estéreo 44,1 kHz no IndexedDB.
- **Mixer:** três `<audio>` sincronizados, que mantêm `playbackRate` + `preservesPitch` nativos.
- **Whisper:** `@huggingface/transformers` (`onnx-community/whisper-small_timestamped`, encoder e decoder q4) num worker. Transcreve a voz separada quando existir, senão a mistura.

**Tech Stack:** o dos planos anteriores + `@huggingface/transformers` (Apache-2.0).

**Spec:** [`docs/superpowers/specs/2026-11-06-will-music-v1-design.md`](../specs/2026-11-06-will-music-v1-design.md) — §6, §7.7, §7.8 (player com faixas), §7.5 (letra) e o Whisper do contexto (§2).

## Global Constraints

- Tudo dos planos anteriores vale.
- **Modelo de separação fixado:**
  - repositório `musetric/mel-band-roformer-duality-kara2-student-onnx`, revisão `48a53200678a45f88e21dc1af957f1e4b55ba5ae`;
  - `duality_kara2_student_core_t1100.onnx` (6 230 015 B, SHA-256 `86a884e0225233a7d77f88e60d9a7e2febdb0d386d19ddc9476fcf51ed858228`);
  - `duality_kara2_student_core_t1100.onnx.data` (235 400 588 B, SHA-256 `176673d2446d8578976dd1a17ebca5fa0651dd23446967ff44fad5bf22c45d5c`).
  - Entrada `stft_repr` `[1, 2050, 1100, 2]`; saída `masks` `[2, 1, 2050, 1100, 2]`.
- **Layout empacotado** (igual ao Musetric):
  - `packed = freq·2 + canal`, com `freq` de 0 a 1024 e canal 0/1;
  - posição `(packed · frames + frame) · 2 + {re, im}`;
  - as máscaras se encadeiam por multiplicação complexa.
- **A separação exige WebGPU.** Sem `navigator.gpu`, mostrar "A separação de faixas precisa de um navegador com WebGPU (Chrome ou Edge atualizados)" e não baixar nada. O spec previa um modo mais lento por CPU, que não é viável para este modelo de 235 MB; a decisão está registrada no ledger.
- **Aviso de tamanho antes de baixar:** separação ~240 MB; Whisper ~300 MB.
- **Fica para depois:** o modo 6 faixas (Demucs). A entrada e a saída daquele export ONNX não estão documentadas e exigem investigação própria; fica registrado como pendência da V1.

## Review Focus

1. **Música mais curta que um bloco (< 11 s)** ou com tamanho que não fecha blocos inteiros → o último bloco é preenchido com zeros e o resultado é cortado no tamanho certo, sem estalos na emenda dos blocos. Teste na Task 2.
2. **Arquivo mono** → é duplicado para estéreo antes da separação, e as faixas saem estéreo. Teste na Task 2.
3. **Faixas fora de sincronia no mixer** depois de pular no tempo, mudar a velocidade ou passar pelo loop A-B → no máximo 40 ms de diferença. As faixas são re-sincronizadas pela faixa principal. Teste na Task 4.
4. **Pouco espaço ou erro no meio da separação** → nada é gravado pela metade; a música continua com o áudio original. Teste na Task 3.
5. **Whisper sem WebGPU** → roda em WASM, avisando que vai demorar; texto vazio ou só "música" não substitui a letra. Teste na Task 5.

---

### Task 1: STFT e iSTFT da separação (engine)

**Files:** criar `packages/engine/src/separation/stft.ts`, `packages/engine/test/separationStft.test.ts`; exportar no `index.ts`.

**Interfaces — Produces:**
- `SEPARATION_GEOMETRY = { nFft: 2048, hop: 441, frames: 1100, channels: 2, chunkSamples: 441 * 1099, sampleRate: 44100 } as const`
- `stftChunk(planar: Float32Array /* [2 × chunkSamples] */): Float32Array` — devolve `stft_repr` `[2050 × 1100 × 2]` no layout empacotado.
  - Quadro `f` lê `x[f·hop + n − nFft/2]` com reflexão nas bordas, multiplicado por Hann `0,5 − 0,5·cos(2πn/nFft)`.
  - FFT real de 2048 pontos (reusar `rfft` do engine).
- `applyMasks(stft: Float32Array, masks: Float32Array, chained: number): Float32Array` — multiplicação complexa encadeada das `chained` primeiras máscaras.
- `istftChunk(spectrum: Float32Array /* layout empacotado */): Float32Array` — iFFT, janela de Hann e overlap-add normalizado pelo envelope `Σw²` (porte do `overlapAdd.wgsl`), devolvendo `[2 × chunkSamples]`.

- [ ] **Step 1: Testes que falham**
  - **Reconstrução:** `istftChunk(stftChunk(x))` ≈ `x` com erro máximo < 1e-4, para ruído estéreo aleatório com semente fixa.
  - **Layout:** um seno de 1 kHz só no canal 1 tem energia em `packed` ímpar perto do bin `round(1000 · 2048 / 44100) = 46` (`packed = 93`) e quase nada em `packed = 92`.
  - **Máscaras:** máscara (1, 0) em tudo → identidade; (0, 0) → silêncio; duas encadeadas (0,5) e (0,5) → amplitude 0,25.
- [ ] **Step 2–4:** falhar → implementar (iFFT: conjugar, `rfft` e escalar, ou um iFFT próprio de 2048) → passar.
- [ ] **Step 5: Commit** — `feat(engine): STFT e iSTFT da separação`

### Task 2: Blocos e montagem das faixas (engine)

**Files:** criar `packages/engine/src/separation/chunks.ts`, `packages/engine/test/separationChunks.test.ts`.

**Interfaces — Produces:**
- `planChunks(totalSamples: number, chunkSamples = SEPARATION_GEOMETRY.chunkSamples, overlap = 0.25): { start: number; length: number }[]` — passo `round(chunkSamples · (1 − overlap))`; o último bloco cobre o fim.
- `sliceChunk(planar: Float32Array, totalSamples: number, start: number, chunkSamples: number): Float32Array` — preenche com zeros depois do fim.
- `createStemAccumulator(totalSamples: number, stems: number)`:
  - `add(chunkIndex, plan, stemOutputs: Float32Array[])` — pesos de crossfade linear nas sobreposições, normalizados para somar 1;
  - `finish(): Float32Array[]` — planar, cortado em `totalSamples`.
- `deriveStems(mix: Float32Array, vocals: Float32Array, backing: Float32Array): { instrumental; lead; backing }` — subtrações amostra a amostra.
- `toStereoPlanar(channels: Float32Array[]): { planar: Float32Array; samples: number }` — mono vira dois canais iguais; mais de 2 canais usa os 2 primeiros.

- [ ] **Step 1: Testes que falham**
  - **Identidade:** com um "modelo identidade" (cada bloco devolve a própria entrada), montar 30 s de ruído estéreo reproduz o original com erro máximo < 1e-5, inclusive nas emendas.
  - **Áudio curto:** 3 s viram 1 bloco, e o resultado tem exatamente `3·44100` amostras por canal.
  - **Mono:** um arquivo mono vira estéreo com canais iguais.
  - **Derivação:** `deriveStems` com `mix = 1`, `vocals = 0,4`, `backing = 0,1` → instrumental 0,6, lead 0,3, backing 0,1.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(engine): blocos e montagem das faixas separadas`

### Task 3: Separação no worker (WebGPU) e armazenamento

**Files:**
- criar `apps/web/src/worker/separation.worker.ts`, `apps/web/src/worker/separationClient.ts`, `apps/web/src/lib/wav.ts`, `apps/web/src/lib/stems.ts`;
- testes `apps/web/test/wav.test.ts`, `apps/web/test/stems.test.ts`;
- modificar `apps/web/src/lib/db.ts` (versão 3: tabela `stems: 'songId'` com `{ songId, model, tracks: { name: 'instrumental' | 'lead' | 'backing'; blob: Blob }[] }`), `packages/engine/src/models.ts` (`kara2Core`, `kara2Data`).

**Interfaces — Produces:**
- `encodeWav16(planar: Float32Array, channels: 2, sampleRate: 44100): Blob` — PCM 16 bits com limite (*clip*) em ±1.
- `decodeForSeparation(blob: Blob): Promise<{ planar: Float32Array; samples: number }>` — `OfflineAudioContext(2, 1, 44100)` + `toStereoPlanar`.
- Protocolo do worker:
  - entrada `{ type: 'separate', planar, samples }`;
  - saídas `{ type: 'progress', stage: 'models' | 'separate', done, total }`, `{ type: 'result', instrumental, lead, backing }` (`Float32Array` planares, transferidos) e `{ type: 'error', message }`.
- O worker:
  - abre a sessão com `executionProviders: ['webgpu']` e `externalData: [{ path: 'duality_kara2_student_core_t1100.onnx.data', data: bytes }]`;
  - para cada bloco: `stftChunk` → `run` → `applyMasks(·, masks, 1)` (voz) e `applyMasks(·, masks, 2)` (backing) → `istftChunk` → acumulador;
  - no fim: `deriveStems`.
- `separateSong(songId, onProgress): Promise<void>`:
  - **sem WebGPU:** erro com a mensagem das Global Constraints;
  - **sucesso:** grava as três faixas numa única transação;
  - **falha:** não grava nada.
- `getStems(songId)`, `deleteStems(songId)`; `deleteSong` passa a apagar as faixas.
- `fetchModel` (Plano 2) aceita os dois arquivos novos; o arquivo de 235 MB é baixado com progresso e conferido por SHA-256 antes de ir para o cache.

- [ ] **Step 1: Testes que falham**
  - `encodeWav16` gera cabeçalho RIFF/WAVE válido (`fmt ` 16 bits, 2 canais, 44100 Hz) e o tamanho certo; ±1,5 vira ±32767.
  - `separateSong` com `navigator.gpu` ausente lança a mensagem de WebGPU sem chamar `fetch`.
  - **Falha no meio:** com um worker falso que falha, nada vai para a tabela `stems` e a música continua intacta.
  - **Sucesso:** com um worker falso que tem sucesso, as 3 faixas ficam gravadas e `deleteSong` remove todas.
- [ ] **Step 2–4:** falhar → implementar (o `separateSong` recebe uma fábrica de worker injetável para os testes) → passar.
- [ ] **Step 5: Commit** — `feat(web): separação de faixas no navegador com WebGPU`

### Task 4: Mixer e player com faixas

**Files:** criar `apps/web/src/lib/mixer.ts`, `apps/web/src/components/Mixer.tsx`, `apps/web/test/mixer.test.ts`; modificar `Player.tsx` (fontes múltiplas) e `Song.tsx` (seção "Faixas": botão "Separar faixas" com o aviso de tamanho, progresso, mixer).

**Interfaces — Produces:**
- `mixVolumes(tracks: { name: string; volume: number; muted: boolean; solo: boolean }[]): Record<string, number>` — com algum solo, só as faixas em solo tocam; mudo zera; volume de 0 a 1.
- `driftCorrections(masterTime: number, others: number[], tolerance = 0.04): (number | null)[]` — novo `currentTime` para as faixas que se afastaram mais que a tolerância, ou `null`.
- `Player` aceita `sources: { name: string; src: string; volume: number }[]` em vez de um único `src`.
  - O primeiro `<audio>` é o mestre: play/pause, seek, velocidade (`playbackRate` + `preservesPitch`) e loop são aplicados a todos.
  - A cada `timeupdate` do mestre, `driftCorrections` re-sincroniza as outras faixas.
- **Seção "Faixas" da música:**
  - sem faixas: botão "Separar faixas" com o aviso "Na primeira vez baixa cerca de 240 MB; precisa de Chrome ou Edge com WebGPU";
  - com faixas: o mixer, com Instrumental, Voz principal e Backing vocals (volume, mudo e solo), mais "Ouvir a música original" e "Apagar faixas".
  - O player usa as faixas quando existem e o mixer está ligado.

- [ ] **Step 1: Testes que falham**

```ts
it('solo wins over the rest and mute silences', () => {
  expect(mixVolumes([{ name: 'instrumental', volume: 1, muted: false, solo: false }, { name: 'lead', volume: 0.8, muted: false, solo: true }, { name: 'backing', volume: 1, muted: true, solo: false }]))
    .toEqual({ instrumental: 0, lead: 0.8, backing: 0 });
});
it('corrects only drifted tracks', () => expect(driftCorrections(10, [10.01, 10.2, 9.9])).toEqual([null, 10, 10]));
```
  - Player com 2 fontes: velocidade 75% aplica `playbackRate 0.75` e `preservesPitch` nas duas `<audio>`; seek no mestre move a outra.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): mixer de faixas no player`

### Task 5: Transcrever a letra com o Whisper

**Files:** criar `apps/web/src/worker/whisper.worker.ts`, `apps/web/src/worker/whisperClient.ts`, `apps/web/src/lib/transcript.ts`, `apps/web/test/transcript.test.ts`; modificar `LyricsPanel.tsx` (botão "Transcrever a letra do áudio") e `Song.tsx`.

**Interfaces — Produces:**
- **Worker:**
  - `pipeline('automatic-speech-recognition', 'onnx-community/whisper-small_timestamped', { device: navigator.gpu ? 'webgpu' : 'wasm', dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' } })`;
  - chamada com `{ language: 'portuguese', task: 'transcribe', return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 }` sobre áudio mono de 16 kHz;
  - progresso do download repassado.
- `transcriptToLines(chunks: { timestamp: [number, number | null]; text: string }[]): LyricLine[]`:
  - um trecho por linha, texto aparado;
  - descarta trechos vazios ou só de ruído (`[Música]`, `(música)`, `♪`, `...`);
  - quebra trechos com mais de 60 caracteres em duas linhas com tempo proporcional.
- `isUsefulTranscript(lines): boolean` — exige pelo menos 3 linhas com letras.
- **Áudio usado:** voz principal + backing quando as faixas existirem; senão a mistura, avisando "Sem separar a voz, a transcrição erra mais".
- **Resultado:** aplicado com `applyLyrics(songId, { source: 'manual', lines })`, marcado como `chosenByUser`. Ele sobrevive à reanálise (Plano 2) e já vem com tempos, sem precisar sincronizar.

- [ ] **Step 1: Testes que falham**

```ts
it('turns whisper chunks into timed lines', () => {
  expect(transcriptToLines([{ timestamp: [12.3, 15], text: ' Ninguém explica Deus ' }, { timestamp: [15, 16], text: '[Música]' }, { timestamp: [20, null], text: 'Aleluia' }]))
    .toEqual([{ start: 12.3, text: 'Ninguém explica Deus' }, { start: 20, text: 'Aleluia' }]);
});
it('splits long chunks', () => {
  const lines = transcriptToLines([{ timestamp: [0, 10], text: 'a'.repeat(40) + ' ' + 'b'.repeat(40) }]);
  expect(lines.map((l) => l.start)).toEqual([0, 5]);
});
it('rejects useless transcripts', () => expect(isUsefulTranscript([{ start: 0, text: '...' }])).toBe(false));
```
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(web): transcrever a letra do áudio com o Whisper`

### Task 6: Verificação no navegador (com o servidor do usuário)

- [ ] **Separação:** separar Imperfeito (o usuário tem as faixas do Moises na pasta para comparar a qualidade) → o mixer toca as 3 faixas sincronizadas; solo na voz principal; velocidade 75%; loop A-B.
- [ ] **Whisper:** transcrever "Primeiros Passos" (que não está no LRCLIB) → a letra aparece sincronizada.
- [ ] **Registro:** anotar no ledger os tempos de separação e de transcrição e a GPU usada. Corrigir com teste que reproduz. Commit — `test(web): verificação de separação, mixer e Whisper`.
