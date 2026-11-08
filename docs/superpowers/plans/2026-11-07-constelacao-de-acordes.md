# Constelação de acordes — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** um módulo novo do Estudo em que o aluno parte de um acorde e navega por uma constelação de acordes ligados por relações de harmonia (função, trítono, ii–V, ciclos, empréstimo), ouvindo e lendo por que cada passo funciona, com um modo alvo que sugere um caminho até um acorde escolhido.

**Architecture:** um motor de harmonia puro em TypeScript (`src/constellation/harmony.ts`) diz, para um acorde e um centro tonal, quais são os vizinhos, com função e explicação; uma busca (`route.ts`) usa esse motor para o modo alvo; um estado puro da constelação (`web.ts`) guarda nós, ligações, posições, rastro e foco. A tela (`ConstellationView.tsx` + `ConstellationPage.tsx`) é SVG 2D com arrastar, zoom e câmera animada, e reaproveita o som (`useStudySynth`, `chordEvents`) e a ajuda de acorde (`ChordHelp`) existentes.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vitest + Testing Library (jsdom), SVG. Sem bibliotecas novas.

**Spec:** `docs/superpowers/specs/2026-11-07-constelacao-de-acordes-design.md`

## Global Constraints

- Nome na interface: **Constelação de acordes**; na entrada do Estudo pode aparecer só "Constelação", com a descrição "Explore caminhos de rearmonização".
- Textos em pt-BR, frases curtas, voz ativa; grafia brasileira de acordes: `7M`, `m7`, `m7(b5)`, `°7`, `7(9)`, `7(13)`, `7(b9)`, `7(#5)`, `m6`.
- Base teórica: centro tonal e função (tônica, subdominante, dominante), ciclos de quintas e quartas, sonoridade. Nunca "está na escala".
- Órbita com 6 a 10 vizinhos; variações de cor do mesmo acorde (G7, G7(9), G7(13), G7(b9), G7(#5)) agrupadas num só vizinho.
- Cores por função sempre acompanhadas do rótulo da função (a cor nunca é a única pista).
- Modo explorar marca só o rastro; caminho sugerido só no modo alvo.
- Celular: primeiro toque seleciona (som + explicação), segundo toque ou botão "Ir" anda. Computador: passar o mouse pré-visualiza, clique anda.
- Nada é salvo na primeira versão.
- 2D, sem dependências novas, roda no aparelho, leve no celular.

## Review Focus

1. **Grafia nos centros com bemol:** em Fá, Si bemol e afins, os acordes saem com bemóis (Db7, Bb7, Ab7M), nunca C#7 ou A#7M. → teste na Task 1 e Task 2.
2. **Mesmo acorde por dois caminhos:** chegar a G7 vindo de C e vindo de Dm7 usa a mesma bolinha, e enarmônicos (C#7 / Db7) também. → teste na Task 4.
3. **Arrastar não anda:** arrastar ou dar pinça sobre uma bolinha não seleciona nem anda (limite de deslocamento). → teste na Task 5.
4. **Alvo impossível ou igual ao atual:** alvo igual ao acorde em foco não sugere nada nem quebra; alvo que a busca não alcança mostra uma mensagem clara. → teste na Task 3 e Task 6.
5. **Partida por acorde "difícil":** começar em m7(b5), °7 ou 7 gera órbita válida e centro coerente. → teste na Task 2.

---

### Task 1: Motor de harmonia — modelo de acorde, grafia e vizinhos num centro maior

**Files:**
- Modify: `apps/web/src/lib/transpose.ts` (exportar a grafia interna)
- Create: `apps/web/src/constellation/harmony.ts`
- Test: `apps/web/test/constellationHarmony.test.ts`

**Interfaces:**
- Produces:
  - `export const spellPitch = (pc: number, key: string | boolean): string` em `transpose.ts` (é a função privada `spell` atual, renomeada e exportada; `transposeChord` passa a usá-la).
  - Em `harmony.ts`:
    ```ts
    export type Quality = '' | 'm' | '7M' | '6' | 'm7' | 'm6' | '7' | 'm7(b5)' | '°7' | 'm(7M)' | '7sus4';
    export type Chord = { root: number; quality: Quality; flat?: boolean }; // root = pitch class 0..11; flat força grafia com bemol
    export type Center = { root: number; minor: boolean };
    export type Family = 'tonica' | 'subdominante' | 'dominante' | 'alterado';
    export type MoveKind = 'cadencia' | 'tritono' | 'subV' | 'iiV' | 'relativo' | 'secundario' | 'cadeia' | 'emprestimo' | 'diminuto' | 'viraDominante' | 'volta';
    export type Move = { to: Chord; kind: MoveKind; family: Family; why: string; nextCenter: Center; variants: string[] };
    export const chordKey = (c: Chord): string;                       // `${root}:${quality}` — identidade por altura, não por grafia
    export const chordName = (c: Chord, center: Center): string;      // "Db7", "Bm7(b5)", "F#m7"; com c.flat, sempre bemol
    export const centerName = (center: Center): string;               // "C", "Bb", "Am"
    export const parseChord = (name: string): Chord | null;           // "Bm7(b5)" → { root: 11, quality: 'm7(b5)' }
    export const startCenter = (c: Chord): Center;
    export const neighbors = (current: Chord, center: Center): Move[];
    ```
  - `chordName` usa `spellPitch(root, c.flat ? true : centerName(center))`. `chordKey` ignora `flat`. `parseChord` marca `flat` quando a fundamental escrita tem `b`.

- [ ] **Step 1: Write the failing tests** em `apps/web/test/constellationHarmony.test.ts`:

```ts
const C = { root: 0, minor: false };
const names = (moves: Move[]) => moves.map((m) => chordName(m.to, C));

it('from C (center C) offers the core paths, each with its kind', () => {
  const moves = neighbors({ root: 0, quality: '7M' }, C);
  const byName = Object.fromEntries(moves.map((m) => [chordName(m.to, C), m]));
  expect(byName['G7']!.kind).toBe('cadencia');            // V7
  expect(byName['Bm7(b5)']!.kind).toBe('tritono');        // mesmo trítono do G7
  expect(byName['Db7']!.kind).toBe('subV');
  expect(byName['Dm7']!.kind).toBe('iiV');
  expect(byName['Am7']!.kind).toBe('relativo');
  expect(byName['A7']!.kind).toBe('secundario');          // V7/ii
  expect(byName['Fm6']!.kind).toBe('emprestimo');
  expect(byName['C7']!.kind).toBe('viraDominante');
  expect(moves.length).toBeGreaterThanOrEqual(6);
  expect(moves.length).toBeLessThanOrEqual(10);
});

it('every move explains itself and carries a family', () => {
  for (const m of neighbors({ root: 0, quality: '7M' }, C)) {
    expect(m.why.length).toBeGreaterThan(10);
    expect(['tonica', 'subdominante', 'dominante', 'alterado']).toContain(m.family);
  }
});

it('Bm7(b5) and G7 share the tritone B–F (the reason for the substitution)', () => {
  const pcs = (c: Chord) => new Set(chordNotes(chordName(c, C))!);
  const g7 = pcs({ root: 7, quality: '7' });
  const bm7b5 = pcs({ root: 11, quality: 'm7(b5)' });
  expect(g7.has(11) && g7.has(5) && bm7b5.has(11) && bm7b5.has(5)).toBe(true);
});

it('groups the colors of a dominant into one neighbor', () => {
  const g7 = neighbors({ root: 0, quality: '7M' }, C).find((m) => chordName(m.to, C) === 'G7')!;
  expect(g7.variants).toEqual(['G7(9)', 'G7(13)', 'G7(b9)', 'G7(#5)']);
  expect(names(neighbors({ root: 0, quality: '7M' }, C)).filter((n) => n.startsWith('G7')).length).toBe(1);
});

it('from Dm7 the ii–V chain continues: G7, and Gm7 as the ii of F', () => {
  const moves = neighbors({ root: 2, quality: 'm7' }, C);
  expect(names(moves)).toContain('G7');
  expect(moves.find((m) => chordName(m.to, C) === 'Gm7')!.kind).toBe('cadeia');
});

it('spells with flats in flat centers', () => {
  const F = { root: 5, minor: false };
  const all = neighbors({ root: 5, quality: '7M' }, F).map((m) => chordName(m.to, F));
  expect(all).toContain('Bbm6');            // empréstimo iv
  expect(all).toContain('Gb7');             // subV
  expect(all.some((n) => n.includes('#'))).toBe(false);
});

it('parses and names round-trip', () => {
  for (const n of ['C7M', 'Dm7', 'G7', 'Bm7(b5)', 'C#°7', 'Fm6', 'Bb7M', 'Am']) expect(chordName(parseChord(n)!, startCenter(parseChord(n)!))).toBe(n);
});
```

- [ ] **Step 2: Run** `npx vitest run test/constellationHarmony.test.ts` (em `apps/web`). Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implement** `spellPitch` (renomear e exportar `spell` em `transpose.ts`) e `harmony.ts`.

Regras de vizinhança por **papel** do acorde atual (o papel sai da qualidade): tônico (`''`, `7M`, `6`), menor (`m`, `m7`, `m6`, `m(7M)`), dominante (`7`, `7sus4`), meio-diminuto (`m7(b5)`), diminuto (`°7`). Cada entrada é `destino (semitons a partir da fundamental r do acorde atual, qualidade) → kind / family`, na ordem de prioridade:

| Papel | Vizinhos |
|---|---|
| tônico | (r+7, `7`) → cadencia/dominante · (r+11, `m7(b5)`) → tritono/dominante · (r+1, `7`, flat) → subV/dominante · (r+2, `m7`) → iiV/subdominante · (r+9, `m7`) → relativo/tonica · (r+4, `m7`) → relativo/tonica · (r+9, `7`) → secundario/alterado · (r+5, `m6`, flat) → emprestimo/subdominante · (r, `7`) → viraDominante/alterado · (r+1, `°7`) → diminuto/alterado · (r+10, `7`, flat) → emprestimo/subdominante |
| menor | (r+5, `7`) → iiV/dominante · (r+11, `7`, flat) → subV/dominante · (r+5, `m7`) → cadeia/subdominante · (r+7, `7`) → secundario/alterado · (r+3, `7M`) → relativo/tonica |
| dominante | (r+5, `7M` se r+5 é grau maior do centro, senão `m7`) → cadencia/tonica · (r+2, `m7`) → relativo/tonica (engano) · (r+5, `7`) → cadeia/dominante · (r+6, `7`, flat) → subV/dominante · (r+4, `m7(b5)`) → tritono/dominante |
| meio-diminuto | (r+5, `7`) → iiV/dominante · (r+1, `7M`) → tritono/tonica · (r+3, `m6`) → relativo/subdominante (mesmas notas) · (r+8, `7`) → tritono/dominante (é o 9 sem fundamental) · (r+11, `7`, flat) → subV/dominante |
| diminuto | (r+1, `m7`) → diminuto/tonica · (r+8, `7`) · (r+11, `7`) · (r+2, `7`) · (r+5, `7`) → tritono/dominante (o °7 é um 7(b9) sem fundamental de quatro dominantes) |

Depois da linha do papel, todo acorde recebe os vizinhos do centro até completar 6: tônica do centro (`7M` ou `m7`) → volta/tonica, V7 do centro → cadencia/dominante, ii do centro (`m7` no maior, `m7(b5)` no menor) → iiV/subdominante. Nunca inclui o próprio acorde atual. Remover duplicatas por `chordKey` (fica a primeira). Limitar a 10 na ordem acima. Variantes: todo vizinho de qualidade `7` recebe `variants` = `(9)`, `(13)`, `(b9)`, `(#5)` nessa ordem, já com o nome (`'G7(9)'`…); os demais `[]`. `nextCenter` na Task 1 é sempre o centro atual (a Task 2 trata tonicização). Cada `why` é uma frase curta escrita com os nomes reais, por exemplo `"Bm7(b5) tem o mesmo trítono do G7 (B e F): resolve no C com outra cor."`.

- [ ] **Step 4: Run** `npx vitest run test/constellationHarmony.test.ts test/transpose.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(constelacao): motor de harmonia — vizinhos por função num centro maior`

---

### Task 2: Centro menor, tonicização e partida por qualquer acorde

**Files:**
- Modify: `apps/web/src/constellation/harmony.ts`
- Test: `apps/web/test/constellationHarmony.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `startCenter(c)` final e `Move.nextCenter` com tonicização; nenhuma assinatura nova.

- [ ] **Step 1: Write the failing tests:**

```ts
it('resolving V→I moves the center (tonicization)', () => {
  const C = { root: 0, minor: false };
  const toF = neighbors({ root: 0, quality: '7' }, C).find((m) => m.kind === 'cadencia')!;   // C7 → F
  expect(chordName(toF.to, C)).toBe('F7M');
  expect(toF.nextCenter).toEqual({ root: 5, minor: false });
  expect(toF.why).toMatch(/centro tonal/);
});

it('a minor center brings the minor relations', () => {
  const Am = { root: 9, minor: true };
  const all = neighbors({ root: 9, quality: 'm7' }, Am).map((m) => chordName(m.to, Am));
  expect(all).toEqual(expect.arrayContaining(['Bm7(b5)', 'E7', 'F7M', 'G7']));   // iiø, V7 da harmônica, VI, VII
});

it('starts from tricky chords with a coherent center and a valid orbit', () => {
  expect(startCenter(parseChord('Bm7(b5)')!)).toEqual({ root: 9, minor: true });   // iiø de Lá menor
  expect(startCenter(parseChord('C#°7')!)).toEqual({ root: 2, minor: false });     // vii°7 de Ré
  expect(startCenter(parseChord('G7')!)).toEqual({ root: 0, minor: false });       // V7 de Dó
  expect(startCenter(parseChord('Dm7')!)).toEqual({ root: 2, minor: true });
  for (const n of ['Bm7(b5)', 'C#°7', 'G7', 'Dm7', 'F7M']) {
    const c = parseChord(n)!;
    const moves = neighbors(c, startCenter(c));
    expect(moves.length).toBeGreaterThanOrEqual(6);
  }
});
```

- [ ] **Step 2: Run** `npx vitest run test/constellationHarmony.test.ts`. Expected: FAIL nos três testes.

- [ ] **Step 3: Implement.** Tonicização: um `cadencia` cujo destino não é a tônica do centro atual muda `nextCenter` para o destino (maior se `7M`/`6`/`''`, menor se `m*`) e acrescenta ao `why` "O centro tonal passa a ser X.". Centro menor: quando o acorde atual é a tônica de um centro menor, a linha "menor" é substituída por: (c+2, `m7(b5)`) → iiV/subdominante · (c+7, `7`) → cadencia/dominante · (c+8, `7M`) → relativo/subdominante · (c+10, `7`) → secundario/dominante · (c+5, `m7`) → iiV/subdominante · (c+3, `7M`) → relativo/tonica · (c+1, `7`, flat) → subV/dominante. `startCenter`: tônico → maior em r; menor → menor em r; dominante → maior em r+5; meio-diminuto → menor em r+10; diminuto → maior em r+1.

- [ ] **Step 4: Run** `npx vitest run test/constellationHarmony.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(constelacao): centro menor, tonicização e partida por qualquer acorde`

---

### Task 3: Modo alvo — sugestão de caminho

**Files:**
- Create: `apps/web/src/constellation/route.ts`
- Test: `apps/web/test/constellationRoute.test.ts`

**Interfaces:**
- Consumes: `neighbors`, `chordKey`, `Chord`, `Center`, `Move` (Task 1–2).
- Produces: `export const suggestRoute = (from: Chord, center: Center, target: Chord, maxSteps = 8): Move[] | null` — lista de passos (o último tem `to` igual ao alvo por `chordKey`), `[]` se `from` já é o alvo, `null` se não alcança em `maxSteps`.

- [ ] **Step 1: Write the failing tests:**

```ts
const C = { root: 0, minor: false };
const Bb7M = { root: 10, quality: '7M' as const };

it('finds a musical path from C to Bb7M, every step a real neighbor', () => {
  const route = suggestRoute({ root: 0, quality: '7M' }, C, Bb7M)!;
  expect(route.length).toBeGreaterThanOrEqual(2);
  expect(route.length).toBeLessThanOrEqual(8);
  expect(chordKey(route.at(-1)!.to)).toBe(chordKey(Bb7M));
  let at = { chord: { root: 0, quality: '7M' } as Chord, center: C };
  for (const step of route) {
    expect(neighbors(at.chord, at.center).some((m) => chordKey(m.to) === chordKey(step.to))).toBe(true);
    at = { chord: step.to, center: step.nextCenter };
  }
  expect(route.some((s) => s.kind === 'iiV' || s.kind === 'cadencia' || s.kind === 'cadeia')).toBe(true);
});

it('returns [] when already at the target and null when unreachable in the step limit', () => {
  expect(suggestRoute(Bb7M, { root: 10, minor: false }, Bb7M)).toEqual([]);
  expect(suggestRoute({ root: 0, quality: '7M' }, C, { root: 6, quality: 'm(7M)' }, 1)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run test/constellationRoute.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** uma busca de menor custo (Dijkstra) sobre `(chordKey, centro)`, até `maxSteps`. Custo por passo: `cadencia`, `iiV`, `cadeia` = 1; `secundario`, `subV`, `tritono`, `relativo` = 1.5; demais = 2; +3 se o passo volta a um acorde já usado no caminho (evita ciclos). Desempate pela ordem de `neighbors`.

- [ ] **Step 4: Run** `npx vitest run test/constellationRoute.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(constelacao): modo alvo sugere caminho musical até o acorde escolhido`

---

### Task 4: Estado da constelação — nós, ligações, posições, rastro e foco

**Files:**
- Create: `apps/web/src/constellation/web.ts`
- Test: `apps/web/test/constellationWeb.test.ts`

**Interfaces:**
- Consumes: Task 1–2.
- Produces:
  ```ts
  export type StarNode = { key: string; chord: Chord; center: Center; x: number; y: number };
  export type Link = { from: string; to: string; move: Move };
  export type Web = { nodes: Record<string, StarNode>; links: Link[]; trail: string[]; focus: string; center: Center; opened: boolean };
  export const startWeb = (chord: Chord): Web;                  // só o acorde de partida, opened = false
  export const openFocus = (web: Web): Web;                     // abre a órbita do foco (cria nós e ligações que faltam)
  export const orbit = (web: Web): Link[];                      // ligações que saem do foco (os vizinhos clicáveis)
  export const preview = (web: Web): Link[];                    // ligações dos vizinhos para o anel seguinte (não clicáveis)
  export const walk = (web: Web, move: Move): Web;              // anda: foco = destino, rastro cresce, centro = move.nextCenter, já abre a órbita nova
  export const focusOn = (web: Web, key: string): Web;          // traz um nó aberto ao foco (o caminho continua dali)
  export const resetWeb = (web: Web): Web;                      // volta ao acorde de partida, rastro limpo
  ```
  Nós são identificados por `chordKey` (enarmônicos são o mesmo nó). Posições em unidades do mundo: o vizinho n de k fica num círculo de raio 220 em volta do nó de origem, em ângulos livres; o anel de prévia, raio 120 em volta de cada vizinho. Nós que já existem não se movem.

- [ ] **Step 1: Write the failing tests:**

```ts
it('starts with a lone chord and opens its orbit on demand', () => {
  const w = startWeb(parseChord('C7M')!);
  expect(Object.keys(w.nodes)).toHaveLength(1);
  expect(orbit(w)).toHaveLength(0);
  expect(orbit(openFocus(w)).length).toBeGreaterThanOrEqual(6);
});

it('walking marks the trail, moves the focus and keeps one node per chord', () => {
  let w = openFocus(startWeb(parseChord('C7M')!));
  const toDm7 = orbit(w).find((l) => chordName(l.move.to, w.center) === 'Dm7')!.move;
  w = walk(w, toDm7);
  expect(w.trail.map((k) => chordName(w.nodes[k]!.chord, w.center))).toEqual(['C7M', 'Dm7']);
  const g7Keys = Object.values(w.nodes).filter((n) => chordName(n.chord, w.center) === 'G7');
  expect(g7Keys).toHaveLength(1);                         // G7 alcançado de C e de Dm7 é a mesma estrela
});

it('preview shows a ring beyond the orbit', () => {
  const w = openFocus(startWeb(parseChord('C7M')!));
  expect(preview(w).length).toBeGreaterThan(orbit(w).length);
  const orbitKeys = new Set(orbit(w).map((l) => l.to));
  expect(preview(w).every((l) => orbitKeys.has(l.from))).toBe(true);
});

it('reset goes back to the start and focusOn continues from an opened star', () => {
  let w = openFocus(startWeb(parseChord('C7M')!));
  const first = orbit(w)[0]!.move;
  w = walk(w, first);
  const back = focusOn(w, w.trail[0]!);
  expect(back.focus).toBe(w.trail[0]);
  expect(resetWeb(w).trail).toEqual([w.trail[0]]);
  expect(resetWeb(w).focus).toBe(w.trail[0]);
});

it('existing stars keep their positions when the web grows', () => {
  let w = openFocus(startWeb(parseChord('C7M')!));
  const before = structuredClone(w.nodes);
  w = walk(w, orbit(w)[0]!.move);
  for (const [k, n] of Object.entries(before)) expect([w.nodes[k]!.x, w.nodes[k]!.y]).toEqual([n.x, n.y]);
});
```

- [ ] **Step 2: Run** `npx vitest run test/constellationWeb.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `web.ts` como funções puras (cada uma devolve um `Web` novo). Ângulo livre: para cada vizinho novo, o primeiro ângulo em passos de 30° (começando no ângulo oposto à ligação de chegada) cujo ponto fica a mais de 90 unidades de qualquer nó existente; se nenhum servir, raio +80 e tenta de novo.

- [ ] **Step 4: Run** `npx vitest run test/constellationWeb.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(constelacao): estado da constelação com rastro, foco e posições estáveis`

---

### Task 5: A tela da constelação — SVG com arrastar, zoom, câmera e toque em dois tempos

**Files:**
- Create: `apps/web/src/constellation/ConstellationView.tsx`
- Test: `apps/web/test/constellationView.test.tsx`

**Interfaces:**
- Consumes: `Web`, `orbit`, `preview`, `chordName` (Task 1–4).
- Produces:
  ```tsx
  export const ConstellationView = (props: {
    web: Web;
    selected: string | null;                 // chave do vizinho selecionado (primeiro toque)
    route?: string[];                        // chaves do caminho sugerido (modo alvo)
    onSelect: (key: string) => void;         // primeiro toque / hover num vizinho da órbita
    onWalk: (key: string) => void;           // segundo toque / clique / Enter
    onFocusStar: (key: string) => void;      // toque numa estrela aberta fora da órbita
    onOpen: () => void;                      // toque no acorde central ainda fechado
  }) => JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests** (RTL, componente controlado):

```tsx
it('first tap selects a neighbor, second tap walks', async () => { /* render com openFocus(startWeb(C7M)); clicar "Dm7" chama onSelect('2:m7'); re-render com selected='2:m7'; clicar de novo chama onWalk('2:m7') */ });
it('a drag over a star neither selects nor walks', () => { /* pointerDown em Dm7, pointerMove +30px, pointerUp → onSelect e onWalk não chamados */ });
it('preview stars are visible but not buttons', () => { /* os acordes do anel de prévia não têm role=button */ });
it('labels every star with its function, not only color', () => { /* cada botão da órbita tem nome acessível com o rótulo da família, ex. "G7, dominante" */ });
it('the orbit is reachable by keyboard and Enter walks', async () => { /* Tab foca a primeira estrela da órbita; setas trocam; Enter chama onWalk */ });
```

- [ ] **Step 2: Run** `npx vitest run test/constellationView.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.** SVG que ocupa o contêiner; um `<g transform>` com a câmera (`x`, `y`, `zoom`). Câmera: centraliza no foco com transição CSS de 450 ms (`prefers-reduced-motion` → sem transição); zoom inicial 1, afasta para caber o rastro (mínimo 0,35, máximo 2,5); roda do mouse e pinça (dois ponteiros) mudam o zoom; arrastar com um ponteiro move a câmera. Toque vira clique só se o ponteiro se moveu menos de 8 px. Estrelas: foco maior e preenchido; órbita como `role="button"` com nome "`{acorde}, {família}`"; prévia com opacidade 0,35, raio menor e sem papel de botão; rastro com linha contínua e estrelas marcadas; estrelas abertas fora da órbita apagadas, clicáveis via `onFocusStar`. Cores por família a partir dos tokens do tema (`--primary` tônica, âmbar dominante, `--glow` subdominante, rosa alterado) com o rótulo da família escrito embaixo do nome.

- [ ] **Step 4: Run** `npx vitest run test/constellationView.test.tsx`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(constelacao): tela da constelação com câmera, zoom e toque em dois tempos`

---

### Task 6: Página, diário do caminho, som, modo alvo e entrada no Estudo

**Files:**
- Create: `apps/web/src/pages/ConstellationPage.tsx`
- Modify: `apps/web/src/App.tsx` (rota lazy `/estudo/constelacao`), `apps/web/src/pages/StudyHome.tsx` (entrada de destaque)
- Test: `apps/web/test/constellationPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–5; `SheetSelect` (`src/ui/SheetSelect.tsx`); `useStudySynth`, `chordEvents` (`src/study/widgets.tsx`); `ChordHelp` (`src/components/ChordHelp.tsx`).
- Produces: `export const ConstellationPage = () => JSX.Element`.

- [ ] **Step 1: Write the failing tests:**

```tsx
it('starts from a chosen chord and opens its orbit on tap', async () => { /* escolher "D" e "m7" nos selects, Começar; aparece só Dm7; tocar abre a órbita (≥6 botões) */ });
it('walking writes one short line per step in the path diary', async () => { /* de C7M, selecionar e andar até Dm7 e depois G7; o diário lista "C7M → Dm7 → G7" e 2 explicações */ });
it('plays the chord when selecting and the whole trail on demand', async () => { /* spy no play de useStudySynth (mock do módulo): selecionar chama play com 1 acorde; "Ouvir o caminho" chama com o rastro */ });
it('target mode suggests a route and recalculates after a detour', async () => { /* alvo Bb7M a partir de C7M: o diário mostra a sugestão terminando em Bb7M; andar para um vizinho fora da rota recalcula a partir dele */ });
it('says so when the target is the current chord or unreachable', async () => { /* alvo = acorde atual → "Você já está em …"; mock de suggestRoute → null → "Não encontrei um caminho até … em 8 passos" */ });
it('reset clears the trail back to the starting chord', async () => { /* andar 2 passos, Recomeçar → rastro só com o acorde de partida */ });
it('is reachable from the Estudo home', () => { /* StudyHome tem link "Constelação" com href /estudo/constelacao e a descrição "Explore caminhos de rearmonização" */ });
```

- [ ] **Step 2: Run** `npx vitest run test/constellationPage.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Início: título "Constelação de acordes", selects de fundamental (12 notas) e tipo (as `Quality` da Task 1 com nomes de `CHORD_TYPES`), botão "Começar". Padrão: C7M.
  - Tela: `ConstellationView` ocupando o espaço útil (altura da janela menos cabeçalho e barra inferior); barra com "centro tonal: X", "Recomeçar", "Ouvir o caminho", "Como tocar" (abre `ChordHelp` do acorde em foco) e o seletor de alvo (fundamental + tipo + "Limpar alvo").
  - Painel do vizinho selecionado: nome, família, `why`, variantes (tocar uma variante a ouve), botão "Ir".
  - Diário: a progressão do rastro e, por passo, a linha `why` do `Move` usado. No modo alvo, a sugestão aparece abaixo como "Sugestão até X: …" e as chaves vão para `route` da view; recalcula a cada passo.
  - Som: `useStudySynth().play(id, chordEvents([nome]))` ao selecionar; o rastro com `chordEvents(nomes, 80, 2)`.
  - Celular: diário e painel numa folha recolhível abaixo da constelação; computador: coluna à direita.
  - `App.tsx`: rota lazy como as demais páginas do Estudo. `StudyHome.tsx`: um cartão de destaque acima das ferramentas, com ícone `Sparkles`, título "Constelação" e "Explore caminhos de rearmonização".

- [ ] **Step 4: Run** `npx vitest run` (suíte inteira) e `npx tsc -p apps/web` na raiz. Expected: tudo passa, sem erros de tipo.

- [ ] **Step 5: Commit** `feat(constelacao): página com diário do caminho, som, modo alvo e entrada no Estudo`
