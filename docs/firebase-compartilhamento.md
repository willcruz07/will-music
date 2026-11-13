# Biblioteca por conta e compartilhamento

Implementação local. Nenhuma regra, índice ou informação foi publicada automaticamente no Firebase.

## Configuração necessária

1. Incorporar o fragmento `firebase-compartilhamento.rules` dentro de `match /databases/{database}/documents` nas regras atuais do projeto Firebase do catálogo. Preservar as regras de `users`, `cifras` e artistas. Não substituir o arquivo inteiro por este fragmento.
2. Revisar regras abrangentes existentes: no Firestore, permissões de blocos sobrepostos se somam. Um `allow read, write: if request.auth != null` recursivo anula o isolamento deste fragmento e precisa ser restringido.
3. Incorporar os índices de `firebase-compartilhamento.indexes.json` aos já existentes. O fieldOverride de `wmCharts` evita indexar o mapa de conteúdo das cifras.
4. Validar as regras no emulador com duas contas e uma terceira sem convite antes de produção; não foi realizado deploy nem teste com contas reais nesta implementação.

## Dados

- `users/{uid}/wmCharts/{songId}`: cifra independente e metadados, sem áudio/análise/modelos.
- `users/{uid}/wmSetlists/{listId}`: sequência e tons. Documentos incluem revisão e tombstone para exclusões offline.
- `wmShares/{uid}__{listId}`: cabeçalho da publicação. `versions/{n}/items/{ordem}` contém cópias imutáveis das cifras, permitindo ler mesmo se a cifra de origem for editada ou removida.
- `wmInvites/{shareId}__{emailNormalizado}`: convite privado, resposta e versões oferecida/aceita/recusada. A identidade do destinatário é conferida pelo e-mail verificado do token Google, sem expor a coleção de usuários.

O remetente publica uma versão explicitamente. A publicação é atômica, limitada a 100 cifras e 5 MiB de conteúdo. Avisos aos destinatários são atualizados depois; se falhar, repetir “Publicar atualização” reaproveita a versão. Publicações antigas são mantidas. Não há envio de MP3, notificações push ou e-mail externo.

## Uso

1. Salvar cifras e criar uma setlist no Palco.
2. Na organização da setlist, abrir **Compartilhar**, informar o e-mail Google e enviar.
3. Na outra conta, abrir o sino: foto/nome do remetente, detalhes, aceitar ou recusar.
4. Ao aceitar, a cópia fica em **Palco → Compartilhadas comigo**, disponível offline. A leitura permite transpor e rolar; o ajuste de tom é pessoal e local.
5. Depois de editar, o dono usa **Publicar atualização do repertório**. O destinatário aceita a nova versão ou mantém a anterior.
6. A conta exibe o estado da sincronização e uma ação para tentar novamente. Falhas mantêm os dados locais.

## Offline, contas e conflitos

O primeiro login após esta atualização assume a biblioteca local existente. Outras contas usam bancos locais distintos. A troca efetiva de UID recarrega a aplicação antes de abrir outro banco, para interromper tarefas antigas. Sair não apaga dados nem permite acesso sem login.

A sincronização concilia cifras e listas ao iniciar, editar e reconectar. A revisão é conferida em transação no servidor. Se dois aparelhos editarem o mesmo item, uma cópia da edição local é preservada com o sufixo “cópia deste aparelho”. Exclusões são tombstones, sem remoção física automática. Modelos, MP3, análises e partituras continuam locais; cifras vinculadas a áudio não entram na biblioteca pessoal de cifras sincronizadas.

Aceitar baixa a versão e registra a resposta. Se o navegador recusar o armazenamento local depois disso, a central oferece **Baixar para offline** novamente. Dados de leitura compartilhada não modificam a versão do dono. As cópias aceitas ficam no aparelho até apagar seus dados; esta etapa não implementa revogação, expulsão de participantes ou limpeza remota de cópias offline.

## Roteiro de validação antes de produção

- Conta A: criar/editar/transpor/excluir cifra e setlist; conta A em outro perfil deve sincronizar essas ações.
- Offline: editar, recarregar e reconectar; conferir sincronização sem perda.
- Editar o mesmo item em dois aparelhos offline e reconectar: preservar cópia de conflito.
- A convida B; B aceita/recusa; C não pode ler versões nem convites por ID direto.
- B não pode editar snapshots, remetente, conteúdo do convite ou versões oferecidas; A não pode forjar aceite de B.
- Publicar versão 2; B pode manter versão 1 e depois aceitar versão 2.
- Testar troca A/B no mesmo navegador e recusa de armazenamento local.
- Safari/PWA offline: leitura de versão previamente aceita, transposição pessoal e retorno ao Palco.

Consultas em tempo real têm custo de leitura no Firestore. Esta primeira versão reconcilia a coleção pessoal completa; para bibliotecas muito grandes, considerar paginação incremental e política de retenção de versões com migração própria.
