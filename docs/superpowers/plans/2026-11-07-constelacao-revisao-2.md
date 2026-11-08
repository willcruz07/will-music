# Constelação de acordes, revisão 2 — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** trocar o modelo de ligações da Constelação por relaxar / tensionar / resolver, com o tipo do acorde escolhido no balão mudando a intenção, e remover o modo alvo.

**Architecture:** o motor (`src/constellation/harmony.ts`) passa a classificar o acorde atual por nível (repouso, afastamento, tensão) e a gerar, para cada vizinho, um `Move` com `motion` e as opções de tipo daquela fundamental (`options: Move[]`, cada uma com movimento, explicação e próximo centro próprios). Estrelas são identificadas por fundamental + grupo de função, então G7 e G7(b9) são a mesma estrela. A tela organiza a órbita em setores por movimento e o balão (sobre o mapa) lista os tipos com dica.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vitest + Testing Library. Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-11-07-constelacao-de-acordes-design.md` (§9 revisão 2 manda; §5 só onde a §9 não fala)

## Global Constraints

- Movimentos e rótulos na interface: **relaxa**, **tensiona**, **resolve** (setores "Relaxar", "Tensionar", "Resolver").
- Um dominante nunca oferece os próprios substitutos (acordes com o mesmo trítono) como próximo passo.
- Resolver só aparece quando o acorde atual é tensão.
- Grafia brasileira e com bemol nos contextos com bemol (regras de grafia da primeira versão continuam valendo).
- Cor nunca é a única pista: todo vizinho tem o rótulo do movimento.
- Sem modo alvo.

## Review Focus

1. **Cores escuras do dominante:** G7(b9) e G7(#5) colocam Cm7 antes de C7M; G7(9) e G7(13) o contrário. → Task 1.
2. **Mesma estrela para cores diferentes:** andar para G7 e depois voltar escolhendo G7(b9) não cria uma segunda estrela G. → Task 2.
3. **Tríade versus sétima na partida:** começar em G (tríade) dá intenção aberta (D7M, C, G7); começar em G7 dá só resolução e continuações de tensão. → Task 1.
4. **Toque na opção do balão não anda sozinho:** escolher um tipo só seleciona e toca o som; andar exige "Ir". → Task 4.
5. **Grafia depois de tonicizar:** Db7 → Gb7M, e a aproximação cromática G7 → F#7 continua com sustenido em Dó. → Task 1.

---

### Task 1: Motor v2 — níveis, movimentos, opções de tipo e intenção pela cor

**Files:**
- Modify: `apps/web/src/constellation/harmony.ts` (reescrita das regras)
- Delete: `apps/web/src/constellation/route.ts`, `apps/web/test/constellationRoute.test.ts`
- Test: `apps/web/test/constellationHarmony.test.ts` (substituir os testes da v1 que contradizem a §9)

**Interfaces:**
- Produces:
  ```ts
  export type Quality = '' | '6' | '7M' | '7M(9)' | '6(9)' | 'm' | 'm7' | 'm6' | 'm7(9)' | 'm(7M)' | '7' | '7(9)' | '7(13)' | '7(b9)' | '7(#5)' | '7sus4' | 'm7(b5)' | '°7';
  export type Group = 'maj' | 'min' | 'dom' | 'hdim' | 'dim';
  export type Level = 'repouso' | 'afastamento' | 'tensao';
  export type Motion = 'relaxa' | 'tensiona' | 'resolve';
  export type Move = { to: Chord; motion: Motion; why: string; nextCenter: Center; options: Move[] };   // options: os tipos da mesma fundamental (inclui o próprio)
  export const groupOf = (q: Quality): Group;
  export const chordKey = (c: Chord): string;          // `${root}:${groupOf(quality)}` — G7 e G7(b9) são a mesma estrela
  export const levelOf = (c: Chord, center: Center): Level;
  export const neighbors = (current: Chord, center: Center): Move[];   // até 14, ordenados resolve → tensiona → relaxa
  // continuam: Chord, Center, chordName, centerName, parseChord, startCenter, QUALITIES
  ```
  `options` de um vizinho de grupo `maj` ou `dom` = tipos `''`, `7M`, `7`, `7(9)`, `7(13)`, `7(b9)`, `7(#5)`, `7sus4`; de grupo `min` = `m7`, `m7(9)`, `m6`, `m`, `7` (vira dominante secundário); `hdim` e `dim` = só o próprio tipo. As opções de um vizinho não têm `options` (lista vazia).

- [ ] **Step 1: Write the failing tests** (substituem os da v1 que contradizem a §9; os de grafia e de partida continuam):

```ts
const C = { root: 0, minor: false };
const at = (moves: Move[]) => Object.fromEntries(moves.map((m) => [chordName(m.to, m.nextCenter), m]));

it('from G7 there is only resolution or more tension, never its own substitutes', () => {
  const m = at(neighbors({ root: 7, quality: '7' }, C));
  expect(m['C7M']!.motion).toBe('resolve');
  for (const n of ['Am7', 'Em7', 'Ab7M']) expect(m[n]!.motion).toBe('resolve');      // engano
  expect(m['C7']!.motion).toBe('tensiona');                                          // ciclo de quartas
  expect(m['F#7']!.motion).toBe('tensiona');                                         // aproximação cromática
  for (const n of ['Bm7(b5)', 'Db7', 'Dm7']) expect(m[n]).toBeUndefined();
});

it('dark colors of the dominant ask for the minor resolution first', () => {
  const dark = neighbors({ root: 7, quality: '7(b9)' }, C).filter((x) => x.motion === 'resolve');
  expect(chordName(dark[0]!.to, dark[0]!.nextCenter)).toBe('Cm7');
  const clear = neighbors({ root: 7, quality: '7(13)' }, C).filter((x) => x.motion === 'resolve');
  expect(chordName(clear[0]!.to, clear[0]!.nextCenter)).toBe('C7M');
});

it('substitutes appear where the tension is approached', () => {
  for (const from of [{ root: 0, quality: '7M' as const }, { root: 2, quality: 'm7' as const }]) {
    const m = at(neighbors(from, C));
    for (const n of ['G7', 'Bm7(b5)', 'Db7']) expect(m[n]!.motion).toBe('tensiona');
  }
});

it('a pure major triad has an open intention', () => {
  const G = parseChord('G')!;
  const m = at(neighbors(G, startCenter(G)));
  expect(m['D7M']!.motion).toBe('relaxa');        // G como IV de D (plagal)
  expect(m['C']!.motion).toBe('relaxa');          // V suave de C
  expect(m['G7']!.motion).toBe('tensiona');
});

it('A7 → Dm7 resolves locally and Dm7 then prepares G7', () => {
  const toDm = at(neighbors({ root: 9, quality: '7' }, C))['Dm7']!;
  expect(toDm.motion).toBe('resolve');
  expect(toDm.nextCenter).toEqual(C);
  expect(toDm.why).toMatch(/prepara/);
  expect(at(neighbors(toDm.to, toDm.nextCenter))['G7']!.motion).toBe('tensiona');
});

it('walks the pattern relaxa, relaxa, relaxa, tensiona, resolve', () => {
  const path = ['Am7', 'Em7', 'F7M', 'G7', 'C7M'];
  const motions: string[] = [];
  let cur: Chord = { root: 0, quality: '7M' };
  let center = C;
  for (const n of path) {
    const m = at(neighbors(cur, center))[n]!;
    motions.push(m.motion);
    cur = m.to;
    center = m.nextCenter;
  }
  expect(motions).toEqual(['relaxa', 'relaxa', 'relaxa', 'tensiona', 'resolve']);
});

it('the balloon offers the types of the root, each with its own intention', () => {
  const g = at(neighbors({ root: 0, quality: '7M' }, C))['G7']!;
  const o = Object.fromEntries(g.options.map((x) => [chordName(x.to, x.nextCenter), x]));
  expect(Object.keys(o)).toEqual(expect.arrayContaining(['G', 'G7M', 'G7', 'G7(9)', 'G7(13)', 'G7(b9)', 'G7(#5)', 'G7sus4']));
  expect(o['G']!.motion).toBe('relaxa');
  expect(o['G7(b9)']!.motion).toBe('tensiona');
  expect(o['G7M']!.nextCenter).toEqual({ root: 7, minor: false });
  for (const x of g.options) expect(x.why.length).toBeGreaterThan(10);
});

it('G7 and G7(b9) are the same star', () => {
  expect(chordKey({ root: 7, quality: '7' })).toBe(chordKey({ root: 7, quality: '7(b9)' }));
});
```

- [ ] **Step 2: Run** `npx vitest run test/constellationHarmony.test.ts` (em `apps/web`). Expected: FAIL nos testes novos.

- [ ] **Step 3: Implement.** Nível do acorde atual: dominantes, `°7` e o viiø do centro → tensão; ii, IV, iv, iiø (fora do viiø) e qualquer menor que não seja relativo ou tônica → afastamento; tônica, relativos (vi, iii) e `7M`/`6`/tríade fora do IV → repouso. Movimento de cada vizinho: atual é tensão e destino estável → `resolve`; destino é tensão → `tensiona`; senão `relaxa`. Regras por nível seguem a tabela da §9.2; tensão: resolução na tônica (r+5; `m7` primeiro quando a cor é `(b9)`/`(#5)`, `7M` primeiro quando `(9)`/`(13)`; com `7` puro, `m7` só nos graus menores do centro), engano em r+2 (`m7`), r+9 (`m7`), r+1 (`7M`, bemol), tensão de novo em r+5 (`7`) e r+11 (`7`, cromático). `7sus4` oferece também o próprio `7` (tensiona). Tonicização: resolver em acorde maior fora da tônica muda o centro; resolver em menor que é grau do centro mantém o centro e a explicação diz que ele prepara o próximo V7. `7M` fora dos graus maiores diatônicos (I e IV no maior; III e VI no menor) muda o centro para a própria fundamental. Grafia: continuam as regras da primeira versão (bemol forçado nos substitutos e empréstimos, herdado nas resoluções, nome no centro de destino). Limite: 14 vizinhos.

- [ ] **Step 4: Run** `npx vitest run test/constellationHarmony.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(constelacao): motor v2 — relaxar, tensionar, resolver e intenção pelo tipo do acorde`

---

### Task 2: Estado v2 — estrela por fundamental e função, setores e tipo escolhido

**Files:**
- Modify: `apps/web/src/constellation/web.ts`
- Test: `apps/web/test/constellationWeb.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Move.motion`, `Move.options`, `chordKey` por grupo).
- Produces: as mesmas funções da v1 (`startWeb`, `openFocus`, `orbit`, `previewStars`, `walk`, `focusOn`, `resetWeb`); `walk(web, move)` aceita qualquer opção do balão e grava o tipo escolhido no nó (`nodes[key].chord = move.to`). `preview` (sem uso) sai.

- [ ] **Step 1: Write the failing tests:**

```ts
it('walking with another color of the same root keeps one star and records the chosen type', () => {
  let w = openFocus(startWeb(parseChord('C7M')!));
  const g = orbit(w).find((l) => chordName(l.move.to, l.move.nextCenter) === 'G7')!.move;
  const dark = g.options.find((o) => o.to.quality === '7(b9)')!;
  w = walk(w, dark);
  expect(Object.keys(w.nodes).filter((k) => k.startsWith('7:'))).toHaveLength(1);
  expect(w.nodes[w.focus]!.chord.quality).toBe('7(b9)');
});

it('places each motion in its own sector around the focus', () => {
  const w = openFocus(startWeb(parseChord('G7')!));
  const f = w.nodes[w.focus]!;
  const side = (motion: string) => orbit(w).filter((l) => l.move.motion === motion).map((l) => Math.atan2(w.nodes[l.to]!.y - f.y, w.nodes[l.to]!.x - f.x));
  const mean = (a: number[]) => Math.atan2(a.reduce((s, x) => s + Math.sin(x), 0), a.reduce((s, x) => s + Math.cos(x), 0));
  expect(Math.abs(mean(side('resolve')) - mean(side('tensiona')))).toBeGreaterThan(Math.PI / 3);
});
```
(Os testes da v1 de rastro, prévia, recomeço, posições estáveis e sobreposição continuam.)

- [ ] **Step 2: Run** `npx vitest run test/constellationWeb.test.ts`. Expected: FAIL nos dois novos.

- [ ] **Step 3: Implement.** Ângulo inicial de cada vizinho novo pelo setor do movimento: resolve −90° (acima), tensiona 0° (direita), relaxa 180° (esquerda), girados pelo ângulo de chegada; dentro do setor, o primeiro ponto livre como na v1. `walk` grava `move.to` no nó (o tipo escolhido) e abre a órbita a partir dele.

- [ ] **Step 4: Run** `npx vitest run test/constellationWeb.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(constelacao): estrela por fundamental e função, setores por movimento e tipo escolhido`

---

### Task 3: Tela v2 — rótulos e cores por movimento

**Files:**
- Modify: `apps/web/src/constellation/ConstellationView.tsx`
- Test: `apps/web/test/constellationView.test.tsx`

**Interfaces:**
- Consumes: Task 2. Props iguais às da v1, sem `route`.

- [ ] **Step 1: Write the failing tests:** trocar as asserções de nome acessível de família para movimento:

```tsx
it('labels every orbit star with its motion', () => {
  render(<ConstellationView web={openFocus(startWeb(parseChord('G7')!))} selected={null} {...handlers()} />);
  expect(screen.getByRole('button', { name: 'C7M, resolve' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'C7, tensiona' })).toBeInTheDocument();
});
it('shows the three sectors as a legend', () => {
  render(<ConstellationView web={web()} selected={null} {...handlers()} />);
  for (const t of ['Relaxar', 'Tensionar']) expect(screen.getByText(t)).toBeInTheDocument();
});
```
(Os demais testes da v1 — dois toques, arrastar, teclado, prévia, roda — continuam, com os nomes de estrela ajustados ao novo rótulo.)

- [ ] **Step 2: Run** `npx vitest run test/constellationView.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** Cor por movimento: resolve `var(--primary)`, tensiona âmbar `#f59e0b`, relaxa `var(--glow)`; texto do movimento embaixo do nome; nome acessível `"{acorde}, {movimento}"`; legenda fixa no canto com os setores presentes na órbita atual ("Resolver" só quando houver). Remover `route`.

- [ ] **Step 4: Run** `npx vitest run test/constellationView.test.tsx`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(constelacao): órbita com cores e rótulos de relaxar, tensionar e resolver`

---

### Task 4: Página v2 — balão com tipos, diário com padrão e sem modo alvo

**Files:**
- Modify: `apps/web/src/pages/ConstellationPage.tsx`
- Test: `apps/web/test/constellationPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3.

- [ ] **Step 1: Write the failing tests** (remover os testes do modo alvo):

```tsx
it('the balloon lists the types of the chosen root with a hint, and choosing one only selects', async () => {
  await startAtC();
  await userEvent.pointer({ keys: '[TouchA]', target: screen.getByRole('button', { name: /^G7, / }) });
  const balloon = screen.getByRole('dialog', { name: /G/ });
  await userEvent.click(within(balloon).getByRole('radio', { name: /^G7\(b9\)/ }));
  expect(within(balloon).getByRole('radio', { name: /^G7\(b9\)/ })).toBeChecked();
  expect(play).toHaveBeenLastCalledWith(expect.any(String), expect.any(Array));
  expect(screen.getByTestId('progression')).toHaveTextContent(/^C7M$/);
  await userEvent.click(within(balloon).getByRole('button', { name: 'Ir' }));
  expect(screen.getByTestId('progression')).toHaveTextContent('C7M → G7(b9)');
});

it('the diary shows the pattern of motions', async () => {
  await startAtC();
  await goTo('Am7');
  await goTo('G7');
  await goTo('C7M');
  expect(screen.getByTestId('pattern')).toHaveTextContent('relaxa → tensiona → resolve');
});

it('has no target mode', async () => {
  await startAtC();
  expect(screen.queryByLabelText(/Alvo/)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run test/constellationPage.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** Balão: cartão sobre a parte de baixo do mapa (`role="dialog"`, nome = fundamental), com `radiogroup` dos `options` do vizinho selecionado (rótulo = nome do acorde, descrição = movimento + `why` curto), opção sugerida marcada ao abrir; tocar numa opção marca e toca o som; "Ir" anda com a opção marcada; fechar com Escape ou ×. Diário: linha `data-testid="pattern"` com os movimentos dos passos unidos por " → ", e por passo: acorde (botão "Voltar para …"), movimento e `why`. Remover o painel "Chegar em um acorde" e o import de `route.ts`.

- [ ] **Step 4: Run** `npx vitest run` (suíte inteira) e `npx tsc -p apps/web` na raiz. Expected: tudo passa.

- [ ] **Step 5: Commit** `feat(constelacao): balão com tipos do acorde, diário com o padrão e sem modo alvo`
