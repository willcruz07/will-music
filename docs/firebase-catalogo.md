# Conta e catálogo Alt7 no will-music

## Fluxo implementado

- `/login`: entrada pública exclusiva com Google. Visitantes são direcionados para ela antes da montagem de qualquer tela interna. `/conta` gerencia a sessão e a saída após autenticação.
- `/?aba=catalogo`: quarta aba da biblioteca, com leitura da collection `cifras` do projeto Alt7. Login Google obrigatório no aplicativo; o servidor continua aplicando suas regras de leitura.
- `/catalogo/:id`: leitura com transposição, tamanho da letra, consulta de diagramas e salvar na biblioteca. A busca é conservada no link de retorno.
- Salvar cria `Song` e `Chart` locais na mesma transação. Nenhum áudio, análise ou documento remoto é criado. O cadastro aparece imediatamente na aba Cifras.
- A identidade local deriva do projeto/collection/documento. Reimportar abre/reutiliza a cópia anterior, sem sobrescrever letra, tom transposto ou outras edições locais.

## Persistência e offline

Firebase Auth mantém a sessão, com alternativas de persistência quando o navegador não disponibiliza IndexedDB. O aplicativo não guarda senhas em arquivos, preferências ou no banco de músicas. Não há autenticação nova offline: um perfil restaurado não comprova que o servidor autorizará a próxima operação.

Cifras salvas são documentos locais independentes no Dexie já utilizado pela biblioteca. A saída da conta mantém esses documentos no aparelho, mas bloqueia as telas até uma nova entrada com Google. Não existe sincronização automática entre aparelhos, contas ou aplicativos. A biblioteca é do dispositivo; não se deve interpretar uma cópia local como conteúdo privado isolado por conta.

Firestore usa cache de memória, sem ativar um segundo banco persistente. A sessão do catálogo mantém até oito páginas e 120 cifras em memória, com renovação após cinco minutos quando online. Pedidos simultâneos de uma mesma página compartilham a consulta. Só cifras explicitamente salvas sobrevivem à recarga offline. Os chunks do aplicativo fazem parte do precache PWA.

## Dados e consultas

- Campos consumidos: `title`, `content`, `style`, `artist.name` e `key`, quando existir. Tom também pode vir de `{key: ...}` no conteúdo. O aplicativo não assume C quando o tom está ausente.
- Anotações `{Intro}` e similares viram comentários visíveis. Cifras entre colchetes, inclusive inversões e extensões, são preservadas.
- Páginas de 24 documentos, ordenadas por `title` ou `artist.name`, com document ID como desempate e cursor do último documento.
- A pesquisa atual é de prefixo, respeitando a caixa e os acentos armazenados no banco. Busca sem distinção de caixa/acentos exige campos normalizados/indexados adicionais; não foi simulada baixando o catálogo inteiro.
- A interface descarta respostas de pesquisas anteriores. Erros de índice ou permissão não são substituídos por resultados de outra busca.
- Não há listeners de catálogo completo, escrita em `cifras`, incremento de visualizações, importação de listas ou sincronização de `songs` do Alt7.

## Configuração e publicação

A configuração web pública foi reaproveitada do Alt7 em `apps/web/src/lib/cloud/config.ts`. Esses identificadores não são credenciais administrativas; autorização continua nas regras Firebase. Nenhum arquivo de conta de serviço foi copiado.

Overrides opcionais no ambiente de build: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`. Todos devem pertencer ao mesmo projeto. É necessário reconstruir a aplicação para alterar essas variáveis.

Validar no Firebase Console, sem modificar regras automaticamente:

1. Authentication: provedor Google habilitado. A interface não oferece e-mail/senha, recuperação de senha ou acesso de visitante.
2. Domínio local e domínio de produção autorizados para o fluxo Google. Safari/PWA pode bloquear popups; o aplicativo orienta a permitir a janela ou tentar no navegador. Não há alternativa por senha.
3. Firestore: leitura de `cifras` liberada para o público ou para usuários autenticados, conforme sua política. O cliente não contorna essas regras.
4. Índices de ordenação dos campos utilizados disponíveis. A interface informa quando o servidor exige configuração.

Referências oficiais: [persistência de autenticação](https://firebase.google.com/docs/auth/web/auth-state-persistence), [autenticação web](https://firebase.google.com/docs/auth/faq-and-troubleshooting), [cursores](https://firebase.google.com/docs/firestore/query-data/query-cursors), [regras de consulta](https://firebase.google.com/docs/firestore/security/rules-query).

## Validação

21 testes relacionados aprovados na revisão de acesso Google: bloqueio de rotas, sessão restaurada/offline, destinos de retorno, adaptação, cópia offline, rollback, concorrência, paginação e atualização da biblioteca. Os testes usam armazenamento local simulado e serviços isolados; não fazem login nem consultas reais ao Firebase. A validação de conta, regras, índices, busca no acervo e experiência visual fica para o navegador do usuário. Nenhum commit ou alteração remota foi realizado.

## Proteção de navegação

`RequireAccount` aguarda a restauração da sessão e exige uma conta vinculada ao provedor Google. A proteção inclui rotas diretas, Estúdio, estudos, listas, catálogo e modo Palco. Menus, preparo de modelos e wake lock só montam após autorização. `/login` redireciona sessões Google restauradas para o destino solicitado ou para a biblioteca; a primeira entrada exige internet. Contas antigas com somente senha não liberam o acesso. Isso é controle da aplicação; autorização de dados remotos continua sendo responsabilidade das regras Firebase.

## Revisão da restauração de sessão

A aplicação aguarda `authStateReady()` e confirma `browserLocalPersistence` antes de habilitar nova entrada. IndexedDB permanece como alternativa se o localStorage for recusado. Se ambos falharem, a interface explica a falha em vez de prometer persistência apenas em memória. O observador `onIdTokenChanged` lê o usuário atual do SDK; o retorno do popup também sincroniza o estado explicitamente. Resultados assíncronos antigos não podem restaurar uma sessão já encerrada. Quando o perfil não inclui o provedor, o aplicativo consulta o `signInProvider` do token fornecido pelo SDK, sem criar um indicador local de autorização.

Testes adicionais cobrem callback inicial atrasado, retorno de popup antes do observador, restauração pendente, metadados incompletos, renovação/saída e fallback de persistência. A ocorrência no navegador do usuário não foi inspecionada diretamente; validação real após recarga continua necessária. Não é necessário apagar dados para carregar esta revisão.

## Perfil de usuário e avatar

Após confirmar a sessão Google, o aplicativo cruza o UID com `users/{uid}` em uma transação. Um perfil novo recebe `name`, `email`, `photoURL`, `notification`, `preferences` e timestamps de servidor em `createdAt`, `updatedAt` e `lastAuth`, seguindo o esquema do Alt7. Em um perfil existente, preserva nome/foto personalizados, preferências, notificações, data de criação e campos de privilégios; atualiza e-mail e datas de acesso, preenchendo nome/foto apenas quando ausentes. Não há busca por e-mail nem gravação em outro UID.

A operação ocorre uma vez por usuário nesta sessão da aplicação, com deduplicação de chamadas simultâneas; renovação de token não repete a escrita após sucesso. Offline, aguarda reconexão. A falha do perfil não encerra a autenticação: a tela Minha conta mostra o motivo e permite nova tentativa. O servidor precisa autorizar o usuário a ler/criar/atualizar o próprio documento; as regras não foram alteradas pelo código.

O cabeçalho e Minha conta exibem o avatar do perfil (ou Google). Na ausência/falha da imagem, usam iniciais ou ícone. A imagem não é baixada em um cache adicional pelo aplicativo.

Validação desta etapa: 27 testes de perfil, avatar, sessão, persistência e rotas passaram. O teste de gravação real depende do login e das regras do Firebase no navegador.

## Artistas e leitura das cifras

A busca por artistas exibe cartões com foto e nome, obtidos de páginas limitadas da coleção `cifras`. Ao abrir um artista, a busca por título e a paginação mantêm o filtro por `artist.slug` (ou `artist.name` quando não há slug). As consultas não carregam todo o acervo. A busca continua sensível a maiúsculas e acentos.

A consulta filtrada por artista e ordenada por título requer índices compostos. As definições estão em `docs/firebase-catalogo.indexes.json`. No Firebase Console, em Firestore > Índices > Composto, crie dois índices para a coleção `cifras`, escopo Coleção: `artist.slug` crescente + `title` crescente; e `artist.name` crescente + `title` crescente. Aguarde o status Ativado e tente novamente. O link de criação fornecido pelo erro do SDK no console do navegador também preenche o índice exigido pela consulta. Este arquivo é uma referência para integrar à configuração existente; não substitui nem remove índices remotos. Nada foi publicado automaticamente.

O leitor passa a quebrar por palavras, preservando as posições dos acordes e os offsets de edição. A transposição aceita notas minúsculas como `c#m7`, acidentes Unicode, inversões e extensões com barra numérica (como `C6/9`), sem confundir a extensão com um baixo.

## Revisão: catálogo compacto e filtros

A listagem usa linhas compactas com avatar, título/artista e metadados, sem banner e sem botão de salvar. Salvar permanece no leitor da cifra. No mobile há uma coluna e, a partir de 768px, duas. Pesquisa, modos e filtros ficam sticky abaixo do header (considerando safe-area). Bottom sheet oferece A–Z/Z–A, letra inicial e estilos reais paginados do campo `style`. O resumo aparece no botão e pode ser limpo. Filtros são mantidos na URL e no retorno da cifra.

Esta revisão substitui a estratégia anterior de artistas: busca páginas adicionais até 24 artistas distintos, com teto de 24 consultas e verificação de tempo entre consultas (12 segundos). Cada consulta lê no máximo as 24 posições restantes, pulando o último nome para não percorrer todas as cifras de um artista. Em conexões lentas ou dados muito repetidos, pode entregar menos de 24 com “Carregar mais”. Não confundir o número carregado com o total do acervo.

Contagem de cifras por artista usa `getCountFromServer`, com até três chamadas por lote, cache de cinco minutos e sem bloquear a lista. Com estilo ativo, a quantidade respeita o estilo. Falha de contagem não inventa um número nem impede abrir o artista. Essas agregações e a descoberta de estilos fazem consultas adicionais ao Firestore; não baixam todo o conteúdo do artista.

Não há campos normalizados no esquema consultado: prefixos, letras e ordenação seguem a grafia/indexação do Firestore (sensíveis a caixa e acentos), não uma ordenação linguística completa em português. A interface informa essa limitação. Estilos são obtidos por cursor do próprio campo, em páginas de até 12 valores distintos, com opção de continuar.

`docs/firebase-catalogo.indexes.json` inclui agora combinações de estilo, artista e título nas duas direções. Se o Firestore pedir um índice, use o link original preservado no console. As definições são locais; não foram publicadas nem substituirão índices existentes automaticamente. Uma falha de índice não remove o filtro para mostrar resultados de outra consulta.

## Foto compartilhada por artista

Fotos válidas encontradas em cifras do mesmo artista são compartilhadas entre avatares e preservadas quando outra ocorrência vier sem foto. Os campos `artist.photo`, `artist.image` e `artist.photoURL` são considerados, com validação de URL HTTPS. Falhas de carregamento da imagem eliminam essa candidata durante a sessão e permitem tentar outra.

Para avatares sem candidata, a interface observa proximidade com a área visível e faz uma busca complementar indexada pelo mesmo slug (ou nome, no formato legado). Cada campo de foto retorna no máximo quatro documentos, com no máximo três buscas de artista simultâneas, deduplicação e intervalo de cinco minutos entre buscas do mesmo artista. Não varre todas as cifras. As novas combinações de índice estão em `docs/firebase-catalogo.indexes.json`, apenas como definição local. Se faltarem índices, o console preserva o erro original para criá-los no Firebase. A foto continua opcional e sua ausência não impede abrir a cifra.
