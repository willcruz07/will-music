# Login e catálogo Firebase

Pedido autorizado: login persistente e consumo da collection `cifras` do Alt7, com design e arquitetura existentes. Revisão solicitada: login obrigatório e exclusivo com Google; `/login` como entrada pública, todas as demais rotas protegidas. Sem commits nem escrita de cifras no servidor.

1. SDK Firebase modular carregado sob demanda. Configuração web pública do mesmo projeto, com overrides Vite. Nunca incluir conta de serviço ou SDK Admin.
2. Serviço de sessão único: estado observado pelo Firebase Auth, persistência local com alternativas quando o navegador recusa IndexedDB, e-mail/senha, Google por popup, recuperação de senha e saída. A senha não é guardada pelo app. A sessão local não comprova autorização no servidor enquanto offline.
3. Catálogo: leitura em páginas de 24 documentos, busca de prefixo por título ou artista usando os campos existentes, cursor estável por snapshot. Erros de índice/permissão apresentados sem substituir resultados por uma busca diferente. Busca não promete ignorar acentos/maiúsculas porque o banco atual não tem campos normalizados confirmados.
4. Adaptador de conteúdo: conservar acordes e comentários do formato Alt7, não inventar tom C. Cópia local transacional com origem remota para evitar duplicações, sem áudio. Não sobrescrever edições ao salvar novamente.
5. Biblioteca recebe quarta aba Catálogo com carregamento lazy; tela de leitura remota e login/conta, links nos Ajustes. Controles de cifra reaproveitam ChartView e ChordHelp.
6. Offline: cifras explicitamente salvas ficam na biblioteca Dexie existente; listagens apenas em memória de sessão, sem baixar todo o catálogo nem manter um segundo cache Firestore persistente. Auth mantém sessão quando permitido. Entrar novamente, recuperar senha e pesquisar novos documentos exigem rede.
7. Verificar integridade de importação, paginação, isolamento de erros/cancelamento, tipos e build. Usuário valida login real, permissões e visual no navegador; pode ser necessário autorizar domínios no console Firebase. Não modificar regras remotas.

Implementado: serviços de conta e catálogo isolados, rotas e aba, leitor, cópia transacional e atualização imediata da biblioteca. SDK Firebase instalado; configuração web pública reaproveitada sem credencial administrativa. 18 testes relacionados passaram. Detalhes e limites em `docs/firebase-catalogo.md`.

Revisão de acesso implementada: removidos formulário e serviços de senha/recuperação, removido acesso de visitante, botão Google com identidade visual própria e gate global antes das telas (inclusive Palco e setup dos modelos). `/conta` mantém gestão e saída. 21 testes relacionados passaram; primeira entrada online, sessão Google restaurada permite uso offline. O console e o backend não foram alterados.

Novo pedido autorizado: cruzar e salvar os dados de cada usuário Google em `users/{uid}` e mostrar seu avatar. Implementado em serviço próprio com transação, preservação de campos personalizados/privilégios, timestamps do servidor e deduplicação por sessão. A sincronização roda depois da autenticação, sem permitir que falha de perfil derrube o login. Tentativa offline é retomada ao reconectar. Avatar compartilhado no cabeçalho e na conta com alternativa de iniciais. 27 testes relacionados passaram.
