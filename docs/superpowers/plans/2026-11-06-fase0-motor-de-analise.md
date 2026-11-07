# Fase 0 — motor de análise e validação dos acordes — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o motor de análise (tom e acordes) que o app vai usar no navegador e uma ferramenta Node que o roda nas 5 músicas de referência e gera o relatório da Fase 0, com o veredito do gate.

**Architecture:** `packages/engine` é TypeScript puro (sem DOM, sem `node:`), roda igual em Node e num Web Worker. Ele recebe PCM, faz downmix, reamostragem e CQT em CPU (o plano CQT vem com o modelo), e conversa com o ONNX por uma interface `TensorRunner`. `tools/phase0` é a casca Node: decodifica com ffmpeg, baixa e confere os modelos, implementa o `TensorRunner` com `onnxruntime-node`, compara com as referências e escreve o relatório.

**Tech Stack:** Node 24, npm workspaces, TypeScript (strict), Vitest, tsx, onnxruntime-node, ffmpeg/ffprobe (só ferramenta de desenvolvimento, não distribuída).

**Spec:** [`docs/superpowers/specs/2026-11-06-will-music-v1-design.md`](../specs/2026-11-06-will-music-v1-design.md) — §6 (modelos) e §7.0 (Fase 0).

Este é o **Plano 1 de 5**. Os seguintes, cada um com seu próprio plano depois do gate:
- **2.** Base do app: PWA, biblioteca local e importação/exportação.
- **3.** Análise no navegador, letra e geração e edição da cifra.
- **4.** Separação de faixas e player.
- **5.** Setlists e modo palco.

## Global Constraints

- Licença do projeto MIT; dependências só MIT, Apache-2.0, BSD ou ISC (ffmpeg é ferramenta local de desenvolvimento, nunca entra no bundle).
- `packages/engine` não importa `node:*`, nem APIs de DOM (`window`, `document`, `AudioContext`); só ECMAScript e `globalThis.crypto.subtle`.
- Modelos fixados por revisão e conferidos por SHA-256 depois do download:
  - `https://huggingface.co/musetric/chordmini-onnx/resolve/8ab85fc0f61439900cd07ac21257a43eac57075c/chordnet.onnx` — `1faee8e1cf168300afe0f47517e76836ac200c3841b0fb430fad7dfea5ad6394`
  - `https://huggingface.co/musetric/chordmini-onnx/resolve/8ab85fc0f61439900cd07ac21257a43eac57075c/cqt-plan.bin` — `c31f0a6fd2d582d753be6628b5daecdee58acba53cba93b2bc2b5c75dee2ba48` (payload SHA-256 interno `9e233a7935aefc8172b3cead5bea8cbd1379c3f67066de7c8d59137cbc9bba94`)
  - `https://huggingface.co/musetric/skey-onnx/resolve/9d90d2a9ff6679df1d64000f4fa750643f247643/skey.onnx` — `5113c1378c1007c8559fcb767593366ba9794397b060535eb80a113db50530fc`
- ChordMini: entrada `features` `[16,108,144]` float32, saída `logits` `[16,108,170]`; 22050 Hz mono por **média** `(L+R)/2`; quadro = 2048/22050 s; suavização por soma de logits num raio de 4 quadros **dentro da mesma janela de 108**.
- S-KEY: entrada `audio` `[1, N]` float32, 22050 Hz mono normalizado pelo pico; saída `probs` `[24]`; ordem das tonalidades = `keyMap` do Musetric.
- Código vindo do Musetric (MIT, commit `f37b6b1b054e08db0ec4411479b8092524d6dac2`) leva comentário de origem no topo do arquivo e entra em `THIRD_PARTY_NOTICES.md`. Nome e logo "Musetric" não aparecem no produto.
- Áudios de teste nunca são versionados; ficam em `WILL_MUSIC_AUDIO_DIR` (padrão `<home>/Music`).
- Interface e relatórios em português; identificadores de código em inglês.

## Review Focus

1. **Caminhos com acentos e caracteres unicode** (ex.: `⧸`, `｜`, `ã`, `ç` nos nomes dos MP3s) devem decodificar no Windows → o ffmpeg é chamado com `spawn` e argumentos em array, nunca por shell (teste na Task 7).
2. **Áudio muito curto** (menos de 1 janela de 108 quadros, ou menos de 4096 amostras) não pode quebrar → CQT retorna os quadros possíveis; acordes vêm como poucos segmentos ou vazio (testes nas Tasks 3 e 5).
3. **Arquivo mono, 48 kHz ou já em 22050 Hz** → downmix e reamostragem lidam com 1 canal e com taxa igual sem distorcer (teste na Task 2).
4. **Silêncio ou quase silêncio** → sem `NaN`; o pico 0 não divide por zero no S-KEY; os acordes viram `N` (testes nas Tasks 2 e 5).
5. **Notação brasileira de cifra na referência** (`C7M`, `F#m7(b5)`, `C/E`, `Bb`, `A#`, `C°`, `G4`, `N.C.`) → interpretada como fundamental + maior/menor, enarmônicos iguais (teste na Task 6).

---

## Estrutura de arquivos

```
package.json                     workspaces, scripts raiz
tsconfig.base.json               strict, ES2022, moduleResolution Bundler
.gitignore                       (já existe) + tools/phase0/.cache/
THIRD_PARTY_NOTICES.md           Musetric (MIT) e modelos
packages/engine/
  package.json                   "@will-music/engine", "type":"module", exports ./src/index.ts
  tsconfig.json
  src/index.ts                   reexporta a API pública
  src/audio/prepare.ts           downmixMean, resample, peakNormalize, prepareAnalysisAudio
  src/cqt/plan.ts                tipos + decodeCqtPlan + verifyCqtPlan (vindo do Musetric)
  src/cqt/frameCount.ts          contagem de quadros (vindo do Musetric)
  src/cqt/fft.ts                 FFT real de 512 pontos
  src/cqt/cpuCqt.ts              computeLogCqt
  src/chords/vocab.ts            chordVocab (vindo do Musetric)
  src/chords/decode.ts           windowFeatures, smoothArgmax, buildChordSegments
  src/chords/labels.ts           toDisplayLabel, toMajMin
  src/key/key.ts                 keyMap, decodeKey
  src/inference/runner.ts        interface TensorRunner
  src/analyze.ts                 chordMiniGraph, skeyGraph, analyzeChords, analyzeKey
  src/eval/sequence.ts           parseReferenceChord, simplifySegments, lcsScore, compareKeys
  test/fixtures/cqt-plan.bin     cópia do artefato (MIT), 23 896 bytes
  test/*.test.ts
tools/phase0/
  package.json                   "@will-music/phase0", scripts phase0, test, test:models
  src/models.ts                  baixar, conferir hash, cache
  src/ffmpeg.ts                  probeAudio, decodeAudio
  src/ortRunner.ts               createOrtRunner (onnxruntime-node)
  src/references.ts              tipo e leitura das referências
  src/report.ts                  renderReport
  src/cli.ts                     orquestra a Fase 0
  test/*.test.ts
docs/fase0/referencias/<id>.json referências das 5 músicas
docs/fase0/relatorio.md          saída gerada
docs/fase0/resultados/<id>.json  saída gerada
```

---

### Task 1: Workspace e decodificação do plano CQT

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `THIRD_PARTY_NOTICES.md`, `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts`, `packages/engine/src/cqt/plan.ts`, `packages/engine/src/cqt/frameCount.ts`, `packages/engine/test/fixtures/cqt-plan.bin`
- Modify: `.gitignore` (adicionar `tools/phase0/.cache/`)
- Test: `packages/engine/test/cqtPlan.test.ts`

**Interfaces:**
- Produces:
  - `type CqtPlan` (campos iguais ao `plan.es.ts` do Musetric: `config {sampleRate, hopLength, nBins, binsPerOctave, fmin, output}`, `earlyDownsampleCount`, `octaves: {index, sampleRate, hopLength, fftSize, binStart, binCount}[]`, `rowOffsets: Uint32Array`, `fftBins: Uint32Array`, `coefficients: Float32Array`, `binLengths: Float32Array`, `downsample {tapCount, halfCoefficients, gain, delay, boundary}`, `payloadSha256`)
  - `decodeCqtPlan(bytes: Uint8Array): CqtPlan`
  - `verifyCqtPlan(bytes: Uint8Array): Promise<CqtPlan>`
  - `getDownsampledSampleCount(n: number): number`
  - `getCqtFrameCount(sampleCount: number, plan: CqtPlan): number`

- [ ] **Step 1: Criar o workspace.** Raiz com `"private": true`, `"type": "module"`, `"workspaces": ["packages/*", "tools/*"]`, scripts `"test": "npm test --workspaces --if-present"` e `"typecheck": "tsc -p packages/engine && tsc -p tools/phase0"`. Dev deps na raiz: `typescript`, `vitest`, `tsx`, `@types/node` (versões atuais na instalação; o lockfile fixa). `tsconfig.base.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `noEmit`, `noUncheckedIndexedAccess`. Engine: `"lib": ["ES2022"]`, sem `types` de Node. Baixar `cqt-plan.bin` da URL fixada para `packages/engine/test/fixtures/` e conferir o SHA-256 (`certutil -hashfile <arquivo> SHA256` ou `sha256sum`).

- [ ] **Step 2: Escrever o teste que falha**

```ts
// packages/engine/test/cqtPlan.test.ts
it('decodes the ChordMini plan', async () => {
  const plan = await verifyCqtPlan(fixtureBytes('cqt-plan.bin'));
  expect(plan.payloadSha256).toBe('9e233a7935aefc8172b3cead5bea8cbd1379c3f67066de7c8d59137cbc9bba94');
  expect(plan.config).toMatchObject({ sampleRate: 22050, hopLength: 2048, nBins: 144, binsPerOctave: 24, output: 'logMagnitude' });
  expect(plan.config.fmin).toBeCloseTo(32.70319566257483, 10);
  expect(plan.earlyDownsampleCount).toBe(1);
  expect(plan.octaves.map((o) => [o.hopLength, o.fftSize, o.binStart, o.binCount]))
    .toEqual([[1024,512,120,24],[512,512,96,24],[256,512,72,24],[128,512,48,24],[64,512,24,24],[32,512,0,24]]);
  expect(plan.downsample.tapCount).toBe(255);
  expect(plan.fftBins.length).toBe(1818);
});
it('rejects a corrupted payload', async () => {
  const bytes = fixtureBytes('cqt-plan.bin'); bytes[200] ^= 0xff;
  await expect(verifyCqtPlan(bytes)).rejects.toThrow(/SHA-256/);
});
it('counts frames like librosa centered frames', async () => {
  const plan = await verifyCqtPlan(fixtureBytes('cqt-plan.bin'));
  expect(getCqtFrameCount(4096, plan)).toBe(3);
  expect(getCqtFrameCount(22050 * 4, plan)).toBe(1 + Math.floor(44100 / 1024));
});
```
`fixtureBytes(name)` é um helper de teste que lê de `test/fixtures` (os testes podem usar `node:fs`; o código de `src` não).

- [ ] **Step 3: Rodar e ver falhar.** `npx vitest run packages/engine/test/cqtPlan.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 4: Implementar.** Portar `plan.es.ts`, `planDecode.es.ts`, `config.es.ts`, `resample/config.es.ts` e `frameCount.es.ts` do Musetric para `src/cqt/plan.ts` e `src/cqt/frameCount.ts`, com o cabeçalho de origem (repositório, commit, licença MIT). `verifyCqtPlan` usa `globalThis.crypto.subtle.digest`. Registrar no `THIRD_PARTY_NOTICES.md` o texto da licença MIT do Musetric (`license.md` do repositório) e as licenças dos dois modelos (MIT).

- [ ] **Step 5: Rodar e ver passar.** Mesmo comando → PASS (3 testes).

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(engine): workspace e decodificação do plano CQT"`

---

### Task 2: Preparação do áudio

**Files:**
- Create: `packages/engine/src/audio/prepare.ts`
- Test: `packages/engine/test/prepare.test.ts`

**Interfaces:**
- Produces:
  - `downmixMean(channels: readonly Float32Array[]): Float32Array` — média simples por amostra; 1 canal → cópia.
  - `resample(input: Float32Array, fromRate: number, toRate: number): Float32Array` — comprimento `Math.round(input.length * toRate / fromRate)`; taxas iguais → cópia.
  - `peakNormalize(audio: Float32Array): Float32Array` — nova cópia dividida pelo pico absoluto; pico 0 → cópia sem alteração.
  - `prepareAnalysisAudio(channels: readonly Float32Array[], sampleRate: number): Float32Array` — `resample(downmixMean(channels), sampleRate, 22050)`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('downmixes stereo by arithmetic mean', () => {
  expect(Array.from(downmixMean([f32([1, 0.5]), f32([0, -0.5])]))).toEqual([0.5, 0]);
  expect(Array.from(downmixMean([f32([0.25])]))).toEqual([0.25]);
});
it('keeps a 1 kHz tone through 44.1k -> 22.05k', () => {
  const out = resample(sine(1000, 0.5, 44100, 2), 44100, 22050);
  expect(out.length).toBe(44100);
  expect(rms(out.subarray(2000, 42000))).toBeCloseTo(0.5 / Math.SQRT2, 2);
  expect(dominantFrequency(out, 22050)).toBeCloseTo(1000, -1);
});
it('removes content above the new Nyquist', () => {
  const out = resample(sine(15000, 0.5, 44100, 1), 44100, 22050);
  expect(rms(out.subarray(1000, 21000))).toBeLessThan(0.005);
});
it('handles 48k and identity rates', () => {
  expect(resample(sine(440, 0.5, 48000, 1), 48000, 22050).length).toBe(22050);
  const same = sine(440, 0.5, 22050, 1);
  expect(resample(same, 22050, 22050)).toEqual(same);
});
it('peak-normalizes without dividing by zero', () => {
  expect(Array.from(peakNormalize(f32([0.25, -0.5])))).toEqual([0.5, -1]);
  expect(Array.from(peakNormalize(f32([0, 0])))).toEqual([0, 0]);
});
```
`f32`, `sine(freq, amp, rate, seconds)`, `rms` e `dominantFrequency` (contagem de cruzamentos por zero) são helpers em `test/helpers.ts`.

- [ ] **Step 2: Rodar e ver falhar.** `npx vitest run packages/engine/test/prepare.test.ts` → FAIL.

- [ ] **Step 3: Implementar** `resample` como sinc com janela de Kaiser (β = 8,6; 32 cruzamentos por zero de cada lado; corte em 0,95 × menor Nyquist), calculado por amostra de saída com posição fracionária. Os demais são diretos.

- [ ] **Step 4: Rodar e ver passar** → PASS (5 testes).

- [ ] **Step 5: Commit** — `git commit -am "feat(engine): downmix, reamostragem e normalização"` (incluir arquivos novos com `git add`).

---

### Task 3: CQT em CPU

**Files:**
- Create: `packages/engine/src/cqt/fft.ts`, `packages/engine/src/cqt/cpuCqt.ts`
- Test: `packages/engine/test/cpuCqt.test.ts`

**Interfaces:**
- Consumes: `CqtPlan`, `getCqtFrameCount`, `getDownsampledSampleCount` (Task 1).
- Produces:
  - `type LogCqt = { frameCount: number; binCount: number; data: Float32Array }` — layout `[frame * binCount + bin]`.
  - `computeLogCqt(pcm22050: Float32Array, plan: CqtPlan): LogCqt`.

**Algoritmo** (reproduz os shaders `downsample`, `frame` e `project` do Musetric):
1. `levels[0..L-1]`, `L = earlyDownsampleCount + octaves.length - 1`.
   - Cada nível aplica meia-banda ao anterior: `out[i] = gain · Σ_tap in[2i + tap − delay] · half[|tap − delay|]`, fora do sinal = 0, `out.length = ceil(in.length / 2)`.
2. A oitava `o` lê `levels[earlyDownsampleCount + o.index − 1]`.
3. `frameCount = getCqtFrameCount(pcm.length, plan)`, o mesmo para todas as oitavas.
4. Para cada quadro `f` de uma oitava, montar a janela de entrada `x[s] = signal[f·hop + s − fftSize/2]` (zero fora), sem janela extra.
   - FFT real direta, com a convenção do numpy: `X[k] = Σ x[n]·e^(−2πikn/N)`.
5. Para cada bin global `b` em `[binStart, binStart + binCount)`: `z = Σ_{j=rowOffsets[b]}^{rowOffsets[b+1]−1} c_j · X[fftBins[j]]`.
   - Multiplicação complexa, com `c_j = (coefficients[2j], coefficients[2j+1])`.
   - Saída: `data[f·144 + b] = ln(|z| + 1e-6)`.

- [ ] **Step 1: Escrever os testes que falham** (valores de referência do librosa, de `packages/cqt/src/cqt/__test__/reference.ts` do Musetric)

```ts
const refs = [[0,38.211262],[12,32.11541],[23,27.398172],[24,27.019209],[47,19.373188],[48,19.105656],[71,13.699096],[72,13.50953],[95,9.686647],[96,9.552778],[119,6.849493],[120,6.754834],[143,4.843322]];
it('silence goes to the log floor', () => {
  const r = computeLogCqt(new Float32Array(4096), plan);
  expect(r.frameCount).toBe(3);
  for (const v of r.data) expect(v).toBeCloseTo(Math.log(1e-6), 5);
});
it.each(refs)('tone at bin %i peaks there with the librosa magnitude', (bin, peak) => {
  const tone = sine(32.70319566257483 * 2 ** (bin / 24), 0.5, 22050, 4);
  const r = computeLogCqt(tone, plan);
  for (let f = 2; f < r.frameCount - 2; f++) expect(peakBin(row(r, f))).toBe(bin);
  const mid = row(r, Math.floor(r.frameCount / 2));
  expect(Math.exp(mid[bin]) - 1e-6).toBeCloseTo(peak, 2);
});
it('is linear in amplitude', () => {
  const a = computeLogCqt(sine(32.703 * 2 ** 3, 0.25, 22050, 4), plan);
  const b = computeLogCqt(sine(32.703 * 2 ** 3, 0.5, 22050, 4), plan);
  const f = Math.floor(a.frameCount / 2);
  expect(Math.exp(row(b, f)[72])).toBeCloseTo(2 * Math.exp(row(a, f)[72]), 1);
});
it('handles input shorter than one hop', () => {
  expect(computeLogCqt(new Float32Array(100), plan).frameCount).toBe(1);
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar** `fft.ts` (radix-2 iterativo, complexo, tamanho potência de 2; função `rfft512(input: Float32Array, out: Float32Array)` que escreve 257 bins intercalados re/im) e `computeLogCqt` conforme o algoritmo acima.
- [ ] **Step 4: Rodar e ver passar** → PASS. Se só a magnitude divergir e o bin de pico estiver certo, conferir o sinal da exponencial da FFT e o deslocamento `− fftSize/2` antes de mexer em qualquer outra coisa.
- [ ] **Step 5: Commit** — `feat(engine): CQT em CPU compatível com o plano do ChordMini`

---

### Task 4: Decodificação dos acordes e rótulos

**Files:**
- Create: `packages/engine/src/chords/vocab.ts`, `packages/engine/src/chords/decode.ts`, `packages/engine/src/chords/labels.ts`
- Test: `packages/engine/test/chords.test.ts`

**Interfaces:**
- Produces:
  - `chordVocab: readonly string[]` (170 itens; portado do Musetric).
  - `windowFeatures(cqt: LogCqt, seqLen = 108, windowsPerRun = 16): Float32Array[]` — cada item tem `16·108·144` floats; preenchido com zeros.
  - `smoothArgmax(logits: Float32Array, frameCount: number, seqLen = 108, chordCount = 170, radius = 4): Int32Array` — `logits` são todos os runs concatenados.
  - `type ChordSegment = { start: number; end: number; raw: string; label: string }`.
  - `buildChordSegments(indices: Int32Array, frameDuration: number): ChordSegment[]` — tempos arredondados a 3 casas; `label = toDisplayLabel(raw)`.
  - `toDisplayLabel(raw: string): string`.
  - `type MajMin = { pc: number; quality: 'maj' | 'min' }` e `toMajMin(raw: string): MajMin | null`.

Tabela de exibição *(decisão do planejamento; padrão de cifra brasileira)*:

| raw | label | | raw | label |
|---|---|---|---|---|
| `C` | `C` | | `C:maj7` | `C7M` |
| `C:min` | `Cm` | | `C:7` | `C7` |
| `C:min7` | `Cm7` | | `C:minmaj7` | `Cm(7M)` |
| `C:maj6` | `C6` | | `C:min6` | `Cm6` |
| `C:dim` | `C°` | | `C:dim7` | `C°7` |
| `C:hdim7` | `Cm7(b5)` | | `C:aug` | `C+` |
| `C:sus2` | `Csus2` | | `C:sus4` | `Csus4` |
| `N` | `N.C.` | | `X` | `?` |

Raízes com sustenido saem como no vocabulário (`C#`, `D#`, `F#`, `G#`, `A#`). A grafia por tonalidade fica para o Plano 3.

`toMajMin`: qualidades `min`, `min6`, `min7`, `minmaj7`, `dim`, `dim7`, `hdim7` → `min`; as demais → `maj`; `N` e `X` → `null`. `pc`: C=0 … B=11.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('pads features into runs of 16 windows of 108 frames', () => {
  const cqt = { frameCount: 200, binCount: 144, data: new Float32Array(200 * 144).fill(1) };
  const runs = windowFeatures(cqt);
  expect(runs).toHaveLength(1);
  expect(runs[0].length).toBe(16 * 108 * 144);
  expect(runs[0][199 * 144]).toBe(1);
  expect(runs[0][200 * 144]).toBe(0);
});
it('smooths within a window and never across windows', () => {
  // quadro 107 (fim da janela 0) e 108 (início da janela 1)
  const logits = new Float32Array(216 * 170);
  for (let f = 0; f < 108; f++) logits[f * 170 + 1] = 1;          // janela 0: "C"
  for (let f = 108; f < 216; f++) logits[f * 170 + 0] = 1;        // janela 1: "C:min"
  const idx = smoothArgmax(logits, 216);
  expect(idx[107]).toBe(1);
  expect(idx[108]).toBe(0);
});
it('builds merged segments', () => {
  const segs = buildChordSegments(Int32Array.from([1, 1, 0, 0, 0]), 0.1);
  expect(segs).toEqual([
    { start: 0, end: 0.2, raw: 'C', label: 'C' },
    { start: 0.2, end: 0.5, raw: 'C:min', label: 'Cm' },
  ]);
});
it.each([['C:maj7','C7M'],['F#:hdim7','F#m7(b5)'],['A:min','Am'],['G:7','G7'],['D:dim','D°'],['N','N.C.']])('labels %s as %s', (raw, label) => {
  expect(toDisplayLabel(raw)).toBe(label);
});
it('reduces to major/minor', () => {
  expect(toMajMin('A:min7')).toEqual({ pc: 9, quality: 'min' });
  expect(toMajMin('G:7')).toEqual({ pc: 7, quality: 'maj' });
  expect(toMajMin('N')).toBeNull();
});
```
- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar** (`buildChordSegments` segue `chordSegments.ts` do Musetric, com o campo `raw` + `label`).
- [ ] **Step 4: Rodar e ver passar** → PASS.
- [ ] **Step 5: Commit** — `feat(engine): decodificação e rótulos de acordes`

---

### Task 5: Tom, interface de inferência e funções de análise

**Files:**
- Create: `packages/engine/src/key/key.ts`, `packages/engine/src/inference/runner.ts`, `packages/engine/src/analyze.ts`
- Modify: `packages/engine/src/index.ts` (exportar a API das Tasks 1–5)
- Test: `packages/engine/test/analyze.test.ts`

**Interfaces:**
- Consumes: `computeLogCqt`, `windowFeatures`, `smoothArgmax`, `buildChordSegments`, `peakNormalize`.
- Produces:
  - `interface TensorRunner { run(feeds: Record<string, { data: Float32Array; dims: readonly number[] }>): Promise<Record<string, Float32Array>>; release(): Promise<void> }`
  - `chordMiniGraph = { inputName: 'features', outputName: 'logits', seqLen: 108, windowsPerRun: 16, bins: 144, chordCount: 170, frameDuration: 2048 / 22050, smoothingRadius: 4 } as const`
  - `skeyGraph = { inputName: 'audio', outputName: 'probs' } as const`
  - `keyMap: readonly { root: string; mode: 'major' | 'minor' }[]` — ordem exata do Musetric: `A Bb B C C# D D# E F F# G G#` maiores, depois `B C C# D D# E F F# G G# A Bb` menores.
  - `type KeyResult = { root: string; mode: 'major' | 'minor'; label: string; index: number; margin: number }` — `label` como `"A major"`; `margin = top1 − top2`.
  - `decodeKey(probs: Float32Array): KeyResult`
  - `analyzeChords(pcm22050: Float32Array, plan: CqtPlan, runner: TensorRunner, onProgress?: (done: number, total: number) => void): Promise<ChordSegment[]>` — um `run` por grupo de 16 janelas; descarta os quadros de preenchimento.
  - `analyzeKey(pcm22050: Float32Array, runner: TensorRunner): Promise<KeyResult>` — `peakNormalize` e depois um único `run` com `dims [1, N]`.

- [ ] **Step 1: Escrever os testes que falham** (com um `TensorRunner` falso)

```ts
it('feeds ChordMini in groups of [16,108,144] and trims padding', async () => {
  const calls: number[][] = [];
  const fake: TensorRunner = {
    async run(feeds) { calls.push([...feeds.features.dims]); const out = new Float32Array(16 * 108 * 170); for (let f = 0; f < 16 * 108; f++) out[f * 170 + 1] = 5; return { logits: out }; },
    async release() {},
  };
  const segs = await analyzeChords(sine(220, 0.5, 22050, 30), plan, fake);
  expect(calls).toEqual([[16, 108, 144]]);
  expect(segs).toHaveLength(1);
  expect(segs[0]).toMatchObject({ raw: 'C', start: 0 });
  expect(segs[0].end).toBeCloseTo(getCqtFrameCount(22050 * 30, plan) * 2048 / 22050, 2);
});
it('returns no chord segments for empty audio', async () => {
  expect(await analyzeChords(new Float32Array(0), plan, fakeAlwaysN)).toEqual([]);
});
it('decodes the key with margin', () => {
  const p = new Float32Array(24); p[3] = 0.1; p[22] = 0.06;
  expect(decodeKey(p)).toEqual({ root: 'C', mode: 'major', label: 'C major', index: 3, margin: expect.closeTo(0.04, 5) });
});
it('peak-normalizes before S-KEY and feeds [1, N]', async () => {
  let seen: { data: Float32Array; dims: readonly number[] } | undefined;
  const fake: TensorRunner = { async run(f) { seen = f.audio; const p = new Float32Array(24); p[0] = 1; return { probs: p }; }, async release() {} };
  await analyzeKey(f32([0.1, -0.2]), fake);
  expect(seen!.dims).toEqual([1, 2]);
  expect(Array.from(seen!.data)).toEqual([0.5, -1]);
});
```
`fakeAlwaysN` devolve logits com o índice 169 (`N`) máximo. Áudio vazio (`length 0`) retorna `[]` sem chamar o runner (o `getCqtFrameCount` lança erro abaixo de 2 amostras, então `analyzeChords` verifica isso antes).

- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar todos os testes do engine** — `npm test -w @will-music/engine` → PASS; e `npx tsc -p packages/engine` → sem erros.
- [ ] **Step 5: Commit** — `feat(engine): análise de tom e acordes sobre TensorRunner`

---

### Task 6: Avaliação contra a referência

**Files:**
- Create: `packages/engine/src/eval/sequence.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/test/sequence.test.ts`

**Interfaces:**
- Consumes: `ChordSegment`, `MajMin`, `toMajMin`, `KeyResult`.
- Produces:
  - `parseReferenceChord(text: string): MajMin | null` — notação brasileira; ignora o baixo após `/`; `N.C.` → `null`.
  - `simplifySegments(segments: ChordSegment[], minDuration = 0.75): MajMin[]` — descarta `N`/`X` e segmentos curtos; funde repetições seguidas depois do descarte.
  - `lcsScore(reference: MajMin[], predicted: MajMin[]): { lcs: number; recall: number; precision: number }` — recall = lcs/|ref|, precision = lcs/|pred|; listas vazias → 0.
  - `compareKeys(reference: { root: string; mode: 'major' | 'minor' }, predicted: KeyResult): 'exact' | 'relative' | 'fifth' | 'wrong'` — relativo: menor = maior + 9 semitons; quinta: mesma moda, ±7 semitons.

Regra de `parseReferenceChord`:
- Fundamental: `[A-G]` + `#` ou `b` opcional. Enarmônicos iguais (`Bb` = `A#` = 10).
- **Menor:** o restante começa com `m` não seguido de `aj`, ou contém `°` ou `dim`.
- **Maior:** todo o resto (`7`, `7M`, `maj7`, `4`, `sus4`, `5`, `+`, `9`, `(9)` etc.).

- [ ] **Step 1: Escrever os testes que falham**

```ts
it.each([
  ['C7M', 0, 'maj'], ['F#m7(b5)', 6, 'min'], ['C/E', 0, 'maj'], ['Bb', 10, 'maj'], ['A#m', 10, 'min'],
  ['C°', 0, 'min'], ['G4', 7, 'maj'], ['Dsus4', 2, 'maj'], ['Cmaj7', 0, 'maj'], ['Em7/D', 4, 'min'], ['E7(9)', 4, 'maj'],
])('parses %s', (t, pc, quality) => expect(parseReferenceChord(t)).toEqual({ pc, quality }));
it('treats N.C. as no chord', () => expect(parseReferenceChord('N.C.')).toBeNull());
it('drops short and empty segments then merges repeats', () => {
  const s = (start: number, end: number, raw: string) => ({ start, end, raw, label: raw });
  expect(simplifySegments([s(0,2,'C'), s(2,2.3,'G'), s(2.3,4,'C'), s(4,5,'N'), s(5,7,'A:min')]))
    .toEqual([{ pc: 0, quality: 'maj' }, { pc: 9, quality: 'min' }]);
});
it('scores by longest common subsequence', () => {
  const C = { pc: 0, quality: 'maj' as const }, G = { pc: 7, quality: 'maj' as const }, Am = { pc: 9, quality: 'min' as const }, F = { pc: 5, quality: 'maj' as const };
  expect(lcsScore([C, G, Am, F], [C, Am, G, Am, F, C])).toEqual({ lcs: 4, recall: 1, precision: 4 / 6 });
  expect(lcsScore([], [C])).toEqual({ lcs: 0, recall: 0, precision: 0 });
});
it.each([
  [{ root: 'A', mode: 'major' }, 'A', 'major', 'exact'],
  [{ root: 'A', mode: 'major' }, 'F#', 'minor', 'relative'],
  [{ root: 'G', mode: 'major' }, 'D', 'major', 'fifth'],
  [{ root: 'G', mode: 'major' }, 'E', 'major', 'wrong'],
])('compares keys %o vs %s %s', (ref, root, mode, out) => {
  expect(compareKeys(ref as never, { root, mode, label: '', index: 0, margin: 0 } as never)).toBe(out);
});
```
- [ ] **Step 2: Rodar e ver falhar** → FAIL.
- [ ] **Step 3: Implementar** (LCS por programação dinâmica O(n·m)).
- [ ] **Step 4: Rodar e ver passar** → PASS.
- [ ] **Step 5: Commit** — `feat(engine): métricas da Fase 0`

---

### Task 7: Casca Node — modelos, ffmpeg e ONNX Runtime

**Files:**
- Create: `tools/phase0/package.json`, `tools/phase0/tsconfig.json`, `tools/phase0/src/models.ts`, `tools/phase0/src/ffmpeg.ts`, `tools/phase0/src/ortRunner.ts`
- Test: `tools/phase0/test/ffmpeg.test.ts`, `tools/phase0/test/models.integration.test.ts`

**Interfaces:**
- Consumes: `TensorRunner`, `prepareAnalysisAudio`, `verifyCqtPlan`, `analyzeChords`, `analyzeKey`, `toMajMin` (engine).
- Produces:
  - `type ModelId = 'chordnet' | 'cqtPlan' | 'skey'`; `MODELS: Record<ModelId, { url: string; sha256: string; file: string }>` com os valores das Global Constraints.
  - `ensureModel(id: ModelId, cacheDir = 'tools/phase0/.cache/models'): Promise<string>` — baixa se faltar, confere SHA-256 (`node:crypto`), apaga e lança erro se divergir, devolve o caminho.
  - `probeAudio(path: string): Promise<{ sampleRate: number; channels: number; duration: number }>` — `ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate,channels:format=duration -of json`.
  - `decodeAudio(path: string): Promise<{ sampleRate: number; channels: Float32Array[] }>` — `ffmpeg -v error -i <path> -f f32le -acodec pcm_f32le -` na taxa original, separando os canais intercalados.
  - Executáveis: `process.env.FFMPEG_PATH ?? 'ffmpeg'` e `process.env.FFPROBE_PATH ?? 'ffprobe'`. Sempre via `spawn(cmd, argsArray)`, sem `shell`.
  - `createOrtRunner(modelPath: string): Promise<TensorRunner>` — `onnxruntime-node`, `executionProviders: ['cpu']`.

Dependências de `tools/phase0`: `@will-music/engine` (workspace), `onnxruntime-node`. Scripts:
- `"test": "vitest run --exclude '**/*.integration.test.ts'"`
- `"test:models": "vitest run test/models.integration.test.ts"`
- `"phase0": "tsx src/cli.ts"`

- [ ] **Step 1: Escrever o teste de ffmpeg que falha.** Ele gera, com o próprio ffmpeg, um WAV estéreo de 1 s a 48 kHz num diretório temporário cujo nome tem `Ninguém ⧸ Explica ｜ Deus` e decodifica.

```ts
it('decodes a file whose path has unicode characters', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'Ninguém ⧸ Explica ｜ Deus ')), 'tom de teste.wav');
  await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1:sample_rate=48000', '-ac', '2', file]);
  expect(await probeAudio(file)).toMatchObject({ sampleRate: 48000, channels: 2 });
  const { sampleRate, channels } = await decodeAudio(file);
  expect(sampleRate).toBe(48000);
  expect(channels).toHaveLength(2);
  expect(channels[0].length).toBeGreaterThan(47000);
});
```
- [ ] **Step 2: Rodar e ver falhar.** `npm test -w @will-music/phase0` → FAIL.
- [ ] **Step 3: Implementar `ffmpeg.ts`** e rodar de novo → PASS.
- [ ] **Step 4: Escrever o teste de integração com os modelos reais** (baixa ~17 MB na primeira vez). A síntese usa notas com 5 harmônicos de amplitude 1/k e pico normalizado em 0,5, a 22050 Hz.

```ts
it('labels a synthetic C major triad as C', async () => {
  const pcm = chordTone([130.81, 261.63, 329.63, 392.0], 8);
  const segs = await analyzeChords(pcm, plan, chordRunner);
  expect(shareOfTime(segs, { pc: 0, quality: 'maj' })).toBeGreaterThan(0.5);
});
it('labels a synthetic A minor triad as A minor', async () => {
  const pcm = chordTone([110.0, 220.0, 261.63, 329.63], 8);
  expect(shareOfTime(await analyzeChords(pcm, plan, chordRunner), { pc: 9, quality: 'min' })).toBeGreaterThan(0.5);
});
it('finds C major on a C–F–G–C progression', async () => {
  const pcm = progression([[130.81,261.63,329.63,392.0],[174.61,349.23,440.0,523.25],[196.0,392.0,493.88,587.33],[130.81,261.63,329.63,392.0]], 2, 3);
  expect((await analyzeKey(pcm, keyRunner)).label).toBe('C major');
});
```
`chordTone`, `progression(chords, secondsEach, repeats)` e `shareOfTime` (fração da duração cujo `toMajMin(raw)` é igual) ficam em `test/synth.ts`.

- [ ] **Step 5: Implementar `models.ts` e `ortRunner.ts`** e rodar `npm run test:models -w @will-music/phase0` → PASS. Se algum teste sintético falhar, **parar e relatar** a saída (segmentos e probabilidades) antes de seguir: é sinal de erro no CQT ou na alimentação do modelo, não do modelo.
- [ ] **Step 6: Commit** — `feat(phase0): ffmpeg, modelos fixados e runner ONNX`

---

### Task 8: Referências, CLI e relatório da Fase 0

**Files:**
- Create: `tools/phase0/src/references.ts`, `tools/phase0/src/report.ts`, `tools/phase0/src/cli.ts`, `docs/fase0/referencias/{imperfeito,ninguem-explica-deus,olhos-coloridos,primeiros-passos,boulevard-of-broken-dreams}.json`
- Test: `tools/phase0/test/report.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 5–7.
- Produces:
  - `type Reference = { id: string; title: string; artist: string; audio: string; key: { root: string; mode: 'major' | 'minor' }; status: 'draft' | 'confirmed'; sequence: string[]; notes?: string }`
    - `audio` é relativo a `WILL_MUSIC_AUDIO_DIR`.
    - `sequence` é a sequência linear da gravação, com repetições expandidas, em notação brasileira.
  - `loadReferences(dir = 'docs/fase0/referencias'): Promise<Reference[]>` — valida campos; acordes da sequência que `parseReferenceChord` não entende geram erro com o nome do arquivo.
  - `type SongResult = { reference: Reference; durationSec: number; processingSec: number; key: KeyResult; keyMatch: 'exact' | 'relative' | 'fifth' | 'wrong'; score: { lcs: number; recall: number; precision: number }; segments: ChordSegment[]; simplified: string[] }`
  - `renderReport(results: SongResult[], date: string): string` — markdown.
  - CLI: `npm run phase0 -w @will-music/phase0 -- [--allow-draft] [--only <id>]`.
    - Escreve `docs/fase0/relatorio.md` e `docs/fase0/resultados/<id>.json` (segmentos completos + sequência simplificada com rótulos de exibição).
    - Recusa referências `draft` sem `--allow-draft`; com a flag, o relatório marca a linha como **rascunho**.

O relatório contém:
- Uma tabela com uma linha por música: Música · Tom referência · Tom previsto · Resultado do tom · Cobertura (recall %) · Ruído (1 − precision, %) · Acordes ref/prev · Duração · Tempo de processamento.
- A média de cobertura.
- O veredito do gate:
  - `≥ 70%`: **Seguir**.
  - Abaixo: **Abaixo da meta: testar Essentia.js; a V1 segue com a cifra como rascunho editável**.
- Por música, a sequência simplificada prevista ao lado da referência.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it('renders the gate verdict from the mean recall', () => {
  const md = renderReport([fakeResult({ recall: 0.8 }), fakeResult({ recall: 0.7 })], '2026-11-06');
  expect(md).toContain('Cobertura média: 75%');
  expect(md).toContain('Seguir');
  expect(renderReport([fakeResult({ recall: 0.5 })], '2026-11-06')).toContain('Abaixo da meta');
});
it('marks draft references', () => {
  expect(renderReport([fakeResult({ recall: 0.9, status: 'draft' })], '2026-11-06')).toContain('rascunho');
});
```
- [ ] **Step 2: Rodar e ver falhar → implementar `references.ts`, `report.ts`, `cli.ts` → rodar e ver passar.**
- [ ] **Step 3: Escrever as 5 referências com `status: "draft"`.**
  - Arquivos de áudio conforme a tabela do spec §7.0.
  - Tons: Imperfeito = A maior; Primeiros Passos = G maior; os demais conforme a cifra usada.
  - A `sequence` é montada a partir de uma cifra pública da música, expandida na ordem em que a gravação toca.
  - Registrar a fonte em `notes`.
- [ ] **Step 4: Checkpoint com o usuário (obrigatório).** Mostrar as 5 sequências e tons e pedir que ele confirme ou corrija como músico. Só depois mudar `status` para `"confirmed"`. Não pular esta etapa.
- [ ] **Step 5: Rodar a Fase 0.** `npm run phase0 -w @will-music/phase0` → `docs/fase0/relatorio.md` gerado com as 5 músicas e o veredito.
- [ ] **Step 6: Commit** — `git add docs/fase0 tools/phase0 && git commit -m "feat(phase0): relatório da Fase 0"` (os áudios não entram).
- [ ] **Step 7: Apresentar o relatório ao usuário** com a cobertura média e o veredito. Se ficar abaixo de 70%, abrir a investigação do Essentia.js como próximo passo antes do Plano 2, conforme o spec.
