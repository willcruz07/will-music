# Catálogo comunitário: opções de cifra, avaliações e criação pública

Data: 16/11/2026. Status: desenho para aprovação.

## Intenção

O catálogo de cifras (coleção `cifras` do Firebase compartilhado com o Alt7) vira um espaço de contribuição da comunidade. Quem corrige uma cifra (acordes, letra, estrutura) não altera a cifra principal: a correção entra como mais uma **opção** daquela mesma música, assinada pelo autor, que outros usuários podem avaliar com estrelas e um comentário curto, e salvar na própria biblioteca. A opção mais bem avaliada vira o **destaque** no will-music. Criar uma cifra nova também pode ser particular (só na biblioteca) ou pública (no catálogo).

Por que: integrar a comunidade musical (o login obrigatório existe para isso) e melhorar a qualidade das cifras sem depender de um moderador.

## Metas

- Dois níveis de edição para cifras vindas do catálogo: **salvar só na minha biblioteca** (comportamento atual) ou **enviar como opção para a comunidade**.
- A cifra principal (`cifras/{id}.chordPro`) nunca é alterada pelo will-music.
- Cada opção mostra autor (nome e foto), média de estrelas, quantidade de avaliações e comentários.
- Uma avaliação por pessoa por opção (e pela principal), que a pessoa pode trocar.
- A opção mais bem avaliada aparece como destaque ao abrir a música.
- Criação de cifra nova: particular ou pública.
- Abrir uma música do catálogo continua custando **1 leitura** do Firestore, com todas as opções e avaliações.

## Fora do escopo

- Denúncia, moderação ou curadoria de opções.
- Promover uma opção a principal no documento do Alt7.
- Notificações para o autor quando recebe avaliação.
- Comentários em conversa (respostas a comentários).
- Sincronização em tempo real (sem `onSnapshot` nesta tela).

## Antimetas (falharia mesmo funcionando)

- Qualquer leitura extra por abertura de música (coleção nova, leitura do perfil do autor, subcoleção de comentários).
- Um usuário conseguir apagar ou alterar a opção ou a avaliação de outra pessoa.
- Quebrar a leitura do Alt7 sobre os mesmos documentos.
- Documento estourar o limite de 1 MiB do Firestore.

## Restrições

- Firestore cobra por leitura: tudo no mesmo documento `cifras/{id}`.
- O documento é lido também pelo Alt7; campos novos não podem mudar `chordPro`, `content`, `title`, `artist`, `style`, `key`.
- Não há backend (Cloud Functions) no projeto; a proteção vem das regras do Firestore.
- As regras não ficam versionadas para deploy: o repositório entrega o trecho em `docs/` e o dono aplica no Console, como nos outros documentos `docs/firebase-*.md`.
- Limite de 1 MiB por documento.

## Abordagens consideradas

1. **Coleção nova do will-music por música.** Isola o Alt7 e o limite de tamanho, mas custa +1 leitura por abertura. Descartada pelo usuário por causa da cobrança por leitura.
2. **Array `chordOptions` no documento.** Simples de ler no console, mas as regras do Firestore não conseguem validar item a item: quem pode acrescentar uma opção pode regravar a lista inteira (apagar ou alterar opções e estrelas de outras pessoas). Mitigações exigiriam Cloud Function ou opções só-acrescentar sem edição.
3. **Objeto `chordOptions` com uma chave nova por opção (escolhida).** Mesma 1 leitura e quantas opções forem necessárias; as regras usam `diff()` de mapas para garantir que cada pessoa só cria/edita a própria opção e só mexe na própria avaliação. O app transforma o objeto em lista ordenada na tela.

Escolha do usuário: abordagem 3, com estrelas e comentário curto dentro da avaliação.

## Modelo de dados

Campos novos em `cifras/{id}` (os existentes não mudam):

```text
chordOptions: {
  "<uid do autor>": {                     // tudo o que uma pessoa enviou para esta música
    author: { uid, name, photo },         // copiado no envio, sem ler o perfil depois
    options: {
      "<optionId>": {
        chordPro: string,                 // texto completo da versão
        createdAt: timestamp (servidor),
        updatedAt: timestamp (servidor)
      }
    }
  }
}
chordRatings: {
  "<uid de quem avalia>": {               // todas as avaliações de uma pessoa nesta música
    name, photo,
    items: {
      "main": { stars: 1..5, comment?: string (≤ 200), at },              // a principal
      "<uid do autor>_<optionId>": { stars: 1..5, comment?: string (≤ 200), at }
    }
  }
}
```

- `optionId`: gerado no cliente, formato `opt_` + 8 caracteres aleatórios `[a-z0-9]`. O identificador público de uma opção é `<uid do autor>_<optionId>`.
- Por que agrupar pelo uid: as regras do Firestore não conseguem descobrir qual chave aleatória foi alterada num mapa (o resultado de `affectedKeys()` só permite perguntar "contém só estas chaves?"). Agrupando por `request.auth.uid`, a regra confere com `hasOnly([request.auth.uid])` que cada pessoa só mexe nas próprias opções e nas próprias avaliações.
- O app achata `chordOptions` numa lista "Opção 1, 2, 3…" e agrega as estrelas de `chordRatings` por item.
- Documento de cifra pública criada no will-music: campos que o Alt7 já lê (`title`, `artist: { name, slug }`, `style`, `chordPro`, `key` quando houver) mais `author: { uid, name, photo }`, `createdAt`, `origin: 'will-music'`.

### Limites

- Até 3 opções por pessoa por música (garantido pela regra: `options.size() <= 3`).
- `chordPro` de cada opção: até 20 000 caracteres (as regras contam caracteres, não bytes).
- Comentário: até 200 caracteres.
- Até 20 autores com opções por música (garantido pela regra: `chordOptions.size() <= 20`).
- Teto de tamanho: o cliente estima o tamanho do documento (JSON do snapshot). Acima de ~700 KB, não aceita nova opção nem comentário; avaliação só com estrelas. As regras não medem o documento inteiro, então esse teto é só do cliente; os limites por campo acima mantêm o pior caso de opções em torno de 20 × 3 × 20 KB ≈ 1,2 MB teórico, e o documento recusaria gravações ao chegar a 1 MiB.
- Quem avalia não pode avaliar a própria opção (bloqueado na interface; a regra não consegue verificar sem percorrer as chaves).

## Comportamento

### Abrir uma cifra do catálogo (`/catalogo/:id`)

- Uma leitura (`getDocFromServer`, como hoje) traz principal, opções e avaliações.
- Seletor no topo: **Principal** e **Opção 1, 2, 3…** O destaque abre selecionado.
- Cada item mostra autor e foto (a principal mostra o artista, como hoje), média de estrelas e número de avaliações.
- Área de avaliações da opção selecionada: lista de nome, foto, estrelas e comentário; formulário para dar/trocar a própria avaliação.
- "Salvar na biblioteca" e "Editar em ChordPro" agem sobre a opção selecionada.

### Destaque

- Média de estrelas de cada item (principal incluída), considerando só itens com pelo menos 3 avaliações.
- Desempate: mais avaliações, depois o mais antigo.
- Se nenhum item tiver 3 avaliações, o destaque é a principal.
- Calculado no aparelho; nenhuma leitura extra.

### Salvar na biblioteca

- A cópia local guarda a origem: `catalogSource` ganha `optionId` opcional.
- Identidade local derivada de projeto + coleção + documento + opção, para que a principal e cada opção possam ser salvas lado a lado sem duplicar.
- Cópias já salvas da principal mantêm o id atual (sem `optionId`).

### Editar uma cifra que veio do catálogo

- A caixa atual "Atualizar também a cifra original no catálogo" e o `saveCatalogChordPro` saem.
- No lugar: escolha entre **Só na minha biblioteca** (padrão) e **Enviar como opção para a comunidade**.
- Enviar exige estar online. Antes de gravar, o app relê o documento (1 leitura, só no envio) para conferir limites e duplicidade com o estado atual.
- Duplicidade: o texto normalizado (espaços nas pontas das linhas e linhas em branco repetidas removidos) não pode ser igual ao da principal nem ao de outra opção. Mensagem clara quando for igual.
- Artista e música continuam os do documento; o editor não muda título nem artista da opção.
- O salvamento local acontece de qualquer forma; se o envio falhar, o rascunho e a cópia local ficam, com mensagem de resultado parcial.

### Autor editando ou apagando a própria opção

- O autor pode reenviar o texto da própria opção (mantém as avaliações) ou apagá-la.
- Ninguém mais altera ou apaga a opção.

### Criar cifra nova

- O fluxo de criação de cifra manual ganha a escolha **Particular** (padrão, como hoje) ou **Pública**.
- Pública exige título, artista e estilo; cria um documento novo em `cifras` e salva a cópia local ligada a ele (`catalogSource`).
- Antes de criar, o app busca por título + artista no catálogo (consulta já existente por prefixo) e, se achar a mesma música, sugere enviar como opção dela.

## Gravações (custo)

- Enviar opção: `update` com caminho `chordOptions.<uid>` (1 gravação) após a releitura de conferência.
- Avaliar: `update` em `chordRatings.<uid>` (1 gravação, sem leitura extra; o estado da tela é atualizado localmente).
- Nenhum listener; nenhuma leitura de perfil de autor.

## Regras do Firestore (trecho a entregar em `docs/`)

Somar ao bloco `cifras` existente, sem afrouxar leitura nem permissões do Alt7:

- `update` permitido a usuário autenticado com e-mail verificado quando as chaves alteradas do documento forem só `chordOptions` e/ou `chordRatings`, e:
  - em `chordOptions`, `diff().affectedKeys().hasOnly([request.auth.uid])`; se a entrada existir depois da gravação, `author.uid == request.auth.uid`, `options.size()` entre 1 e 3 e `chordOptions.size() <= 20`;
  - em `chordRatings`, `diff().affectedKeys().hasOnly([request.auth.uid])`;
  - validação de tipos e tamanhos possível sem percorrer chaves aleatórias (por exemplo, tipo mapa e tamanho dos mapas). A validação item a item (estrelas 1–5, comentário ≤ 200, `chordPro` ≤ 20 000) é feita no cliente; como cada pessoa só grava na própria entrada, um cliente adulterado só estraga os próprios dados, não os de outros.
- `create` de cifra pública permitido a usuário autenticado quando `author.uid == request.auth.uid`, `origin == 'will-music'`, sem `chordOptions` com conteúdo de outros e com os campos obrigatórios tipados.
- Nenhuma regra permite alterar `chordPro`, `content`, `title`, `artist`, `style` ou `key` de documentos existentes a partir do will-music.

## Decisões tomadas na revisão (chamadas do Claude, a conferir)

- Até 3 opções por pessoa por música; reenviar a partir de uma cópia que veio da própria opção substitui essa opção em vez de criar outra.
- Cifra pública criada aqui grava `chordPro` e também `content` com o mesmo texto, para aparecer no Alt7 mesmo que ele leia só `content`. `artist.slug` gerado como minúsculas sem acentos, palavras unidas por hífen; ao escolher um artista já existente na busca, reutiliza o slug dele.
- Quem cria uma cifra pública pode corrigir o `chordPro`/`content` do próprio documento enquanto ele não tiver opções de outras pessoas; não pode apagar.
- Banda: aceita. Com os limites acima, a maioria dos documentos terá 0–3 opções (poucas dezenas de KB a mais nas listagens).
- Risco externo, fora deste repositório: se o Alt7 regravar documentos de `cifras` com `set` sem `merge`, apaga `chordOptions` e `chordRatings`. Conferir no Alt7.
- O trecho de regras é para somar ao bloco `cifras`; se o Alt7 já tiver um `allow update` amplo, as restrições novas não protegem nada (regras se somam por OU). Conferir no Console antes de aplicar.

## Deixado para quem constrói

- Componentes e layout do seletor de opções e da área de avaliações, seguindo o padrão visual do catálogo atual (mobile primeiro).
- Normalização exata para comparar textos e a geração do `optionId`.
- Como estimar o tamanho do documento no cliente.
- Mensagens de erro e textos de interface.
- Testes automatizados não são critério de pronto neste projeto: verificar com typecheck e build, e validação no navegador pelo usuário.
