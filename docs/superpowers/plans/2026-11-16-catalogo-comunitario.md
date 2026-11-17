# Catálogo comunitário — plano de implementação

> Execução: nativa, nesta sessão. Por preferência do usuário, a verificação é typecheck + build (`npx tsc -p apps/web`, `npm run build -w @will-music/web`) e validação no navegador pelo usuário; não há etapas de testes automatizados.

**Objetivo:** opções de cifra da comunidade, avaliações e criação pública dentro do documento `cifras/{id}`, com 1 leitura por abertura.

**Arquitetura:** funções puras em `lib/communityCatalog.ts` (ler o documento, chaves, médias, destaque, duplicidade, tamanho); gravações em `lib/cloud/catalog.ts` com `update` por caminho de campo (`chordOptions.<uid>`, `chordRatings.<uid>`); tela do catálogo e editor consomem essas funções.

**Spec:** `docs/superpowers/specs/2026-11-16-catalogo-comunitario-design.md`

## Restrições globais

- `chordOptions.<uid>` = `{ author: {uid,name,photo}, options: { <optionId>: { chordPro, createdAt, updatedAt } } }`; `optionId` = `opt_` + 8 `[a-z0-9]`; chave pública `<uid>_<optionId>`.
- `chordRatings.<uid>` = `{ name, photo, items: { main | <uid>_<optionId>: { stars 1..5, comment? ≤200, at } } }`.
- Limites: 3 opções por pessoa, 20 autores, `chordPro` ≤ 20 000 caracteres, comentário ≤ 200, teto do documento ~700 KB (opção nova e comentário recusados acima).
- Destaque: maior média entre itens com ≥ 3 avaliações; desempate por mais avaliações, depois mais antigo; senão a principal.
- O will-music nunca altera `chordPro`/`content`/`title`/`artist`/`style`/`key` de documento alheio.

## Review Focus

1. Cifra antiga sem `chordOptions`/`chordRatings` abre como antes (só a principal).
2. Enviar texto igual à principal ou a outra opção (diferindo só em espaços) é recusado com mensagem.
3. O autor não vê formulário para avaliar a própria opção.
4. Salvar a principal e uma opção na biblioteca cria duas cópias distintas; cópias antigas da principal continuam reconhecidas.
5. Offline: escolher "só na biblioteca" salva normalmente; envio à comunidade pede conexão sem perder o texto.

---

### Tarefa 1: dados e funções puras

**Arquivos:** criar `apps/web/src/lib/communityCatalog.ts`; modificar `apps/web/src/lib/catalogData.ts` (`CatalogChart`, `mapCatalogChart`, `catalogLocalId`, `saveCatalogChart`, `findSavedCatalogChart`), `apps/web/src/lib/db.ts` (`Song.catalogSource.optionKey?: string`).

**Produz:**
- tipos `CatalogOption = { key: string; id: string; author: {uid,name,photo}; chordPro: string; createdAt: string; updatedAt: string }`, `CatalogRatingEntry = { stars: number; comment?: string; at: string; uid: string; name: string; photo: string }`, `CatalogRatings = Record<string /*uid*/, { name: string; photo: string; items: Record<string, { stars: number; comment?: string; at: string }> }>`.
- `CatalogChart` ganha `options: CatalogOption[]`, `ratings: CatalogRatings`, `author?: {uid,name,photo}`, `docBytes: number`.
- `parseCommunity(data): { options; ratings; author? }`, `ratingsFor(ratings, itemKey): CatalogRatingEntry[]`, `ratingSummary(entries): { average: number; count: number }`, `highlightKey(chart): string` (`'main'` ou chave da opção), `normalizeChordPro(text): string`, `duplicateOf(chart, text, ignoreKey?): string | null`, `newOptionId(): string`, `estimateBytes(value: unknown): number`, `slugify(text): string`, constantes `MAX_OPTIONS_PER_AUTHOR=3`, `MAX_AUTHORS=20`, `MAX_CHORDPRO=20000`, `MAX_COMMENT=200`, `MAX_DOC_BYTES=700_000`.
- `catalogLocalId(remoteId, optionKey?)`; `saveCatalogChart(item, transpose, fontSize, optionKey?)` grava o texto da opção e `catalogSource.optionKey`; `findSavedCatalogChart(id, optionKey?)`.

### Tarefa 2: gravações no Firestore

**Arquivo:** `apps/web/src/lib/cloud/catalog.ts` — remover `saveCatalogChordPro`; acrescentar:
- `submitCatalogOption(chartId: string, chordPro: string, replaceId?: string): Promise<CatalogChart>` — relê do servidor, confere limites/duplicidade/teto, grava `chordOptions.<uid>` com `update`.
- `deleteCatalogOption(chartId: string, optionId: string): Promise<CatalogChart>`.
- `rateCatalogItem(chart: CatalogChart, itemKey: string, stars: number, comment?: string): Promise<CatalogChart>` — sem leitura; grava `chordRatings.<uid>` com os itens atuais da pessoa mais o novo; recusa a própria opção.
- `createPublicChart(input: { title; artist; style; key?: string; chordPro }): Promise<CatalogChart>` — grava `title, artist:{name,slug}, style, key?, chordPro, content, author, createdAt, origin:'will-music'`.
- `updateOwnPublicChart(chart: CatalogChart, chordPro: string): Promise<CatalogChart>` — só quando `author.uid` é o usuário e não há opções de outras pessoas.
- Cache `documents` atualizado após cada gravação.

### Tarefa 3: tela da cifra no catálogo

**Arquivos:** modificar `apps/web/src/pages/CatalogChart.tsx`; criar `apps/web/src/components/CatalogOptions.tsx` (seletor Principal/Opção N com autor e média) e `apps/web/src/components/CatalogReviews.tsx` (lista de avaliações e formulário de estrelas + comentário).
- Abre selecionando `highlightKey`; "Salvar na biblioteca"/"Editar em ChordPro"/visualização usam o texto do item selecionado.
- Autor da opção vê "Apagar minha opção" e não vê o formulário de avaliação dela.

### Tarefa 4: editor — enviar opção e criar pública

**Arquivos:** reescrever `apps/web/src/lib/useCatalogPublication.ts` e `apps/web/src/components/CatalogPublication.tsx`; ajustar `apps/web/src/pages/EditChart.tsx` e `apps/web/src/components/ChartOptions.tsx` para a nova API (mesmos `applicable`, `blocked`, `save`, `needsMigration` removido).
- Modos: `'local'` (padrão), `'option'` (cifra do catálogo), `'main'` (dono da cifra pública sem opções alheias), `'public'` (cifra manual sem origem; pede estilo; título e artista vêm da música).
- `save(text, localSave)`: grava local sempre; no modo remoto grava antes e, em `'public'`, liga `catalogSource` da música ao novo documento.

### Tarefa 5: regras e documentação

**Arquivo:** criar `docs/firebase-catalogo-comunidade.md` com o fluxo, o trecho de regras do spec e os riscos externos (Alt7 com `set` sem merge; `allow update` amplo existente). Atualizar `docs/firebase-catalogo-edicao.md` apontando que a edição da principal foi substituída.

### Tarefa 6: verificação

Run: `npx tsc -p apps/web` → sem erros. Run: `npm run build -w @will-music/web` → `built in`.
