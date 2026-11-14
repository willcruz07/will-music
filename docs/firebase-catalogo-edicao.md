# Edição canônica de cifras do catálogo

## Leitura e edição

O adaptador retorna sempre `chordPro`, priorizando o campo `cifras/{id}.chordPro` quando é texto não vazio. Apenas documentos antigos usam `content`, convertido das anotações Alt7 para ChordPro na entrada. O campo legado não circula mais como conteúdo do modelo de leitura/edição do aplicativo. Formatação de ChordPro já existente é preservada.

No catálogo, **Editar em ChordPro** prepara/abre a cópia na biblioteca. Cifras importadas abrem somente no formato ChordPro no editor. Tanto a página de edição quanto o sheet de letra/cifra exibem **Atualizar também a cifra original no catálogo**, marcada por padrão para origens do projeto Firebase atual. A opção permite revisar a versão atual do catálogo. Desmarcar mantém o salvamento pessoal, inclusive offline. Fontes importadas de outro projeto não publicam neste catálogo.

Salvar com publicação marcada atualiza primeiro o documento original e depois a cópia pessoal. O servidor recebe somente `{ chordPro: texto }`, via transaction.update, sem set substitutivo. `content`, artista, título, estilo e outros campos do documento são preservados. Mesmo sem alterar caracteres, uma cifra antiga pode ser salva para criar o novo campo. Transposição/tamanho de letra continuam configurações pessoais; não são publicados como texto transposto.

## Concorrência e falhas

A referência é lida do servidor ao abrir a edição. A transação lê novamente o documento e compara seu texto com a referência original. Se outra pessoa alterou a cifra, o salvamento é recusado e o rascunho permanece. **Recarregar referência do catálogo** mantém o texto editado e permite conferir a versão recente antes de uma nova tentativa. Não há sobrescrita automática nem mesclagem de revisões.

Recusa de permissão ou falha de conexão não fecha o editor nem modifica a cópia local. O usuário pode tentar novamente ou desmarcar a publicação e salvar pessoalmente. Se o catálogo for atualizado e o armazenamento local falhar depois, a mensagem informa o resultado parcial; repetir o salvamento permite recuperar a cópia pessoal. Não existe transação atômica entre Firestore e IndexedDB.

Não há fila automática para alterações do acervo compartilhado. Elas exigem conexão e uma ação de salvar no editor. Apenas as cifras efetivamente salvas migram para o novo campo; não existe migração em massa nem remoção automática de `content`.

## Permissões do Firebase

O código respeita as permissões reais de escrita em `cifras`. Não foi concedida permissão ampla a usuários autenticados, nem houve edição de regras remotas. O catálogo compartilhado pode ser alterado por todos que tiverem permissão no servidor; a checagem na interface não substitui as regras.

Se as regras atuais permitem apenas leitura, o responsável pelo Firebase precisa integrar uma permissão de atualização com o predicado de editor/administrador já adotado pelo projeto. Restringir o diff a `['chordPro']`, exigir texto não vazio e limitar tamanho. Não usar um campo de perfil que o próprio usuário possa editar para conceder esse acesso. Exemplo opcional com claim administrada por backend confiável:

```text
match /cifras/{id} {
  // Somar ao bloco existente, preservando leituras e permissões administrativas legítimas.
  allow update: if request.auth != null
    && request.auth.token.email_verified == true
    && request.auth.token.get('catalogEditor', false) == true
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['chordPro'])
    && request.resource.data.chordPro is string
    && request.resource.data.chordPro.size() > 0
    && request.resource.data.chordPro.size() <= 300000;
}
```

A claim é um exemplo, não foi criada nem é obrigatória para o cliente: pode-se usar o predicado de edição já existente. Regras permissivas sobrepostas se somam; revisar a configuração completa. Não são necessários novos índices para a atualização por ID. Validar em ambiente de teste com um editor autorizado e uma conta sem permissão antes de produção.
