# Partituras compartilhadas por link

Desenho: [superpowers/specs/2026-11-17-editor-partituras-design.md](superpowers/specs/2026-11-17-editor-partituras-design.md).

## Como funciona

- O professor escreve a partitura no aparelho (IndexedDB, tabela `sheets`). Nada vai para a nuvem até ele tocar em **Criar link de compartilhamento**.
- Publicar grava um documento `wmSheets/{id}` com `ownerUid`, `ownerName`, `title`, `sheet` (a partitura inteira) e `updatedAt`. O link é `/partitura/compartilhada/{id}`.
- Abrir o link custa **1 leitura**. A partitura fica guardada no aparelho do aluno (tabela `sharedSheets`, lista "Compartilhadas comigo") e abre offline depois.
- Editar no aparelho não muda o link: o editor mostra "alterações não publicadas" até o professor tocar em **Publicar alterações** (1 gravação).
- **Parar de compartilhar** apaga o documento; cópias salvas pelos alunos continuam com eles.

## Regras do Firestore (somar às regras existentes)

```text
match /wmSheets/{sheetId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.ownerUid == request.auth.uid
    && request.resource.data.keys().hasOnly(['ownerUid', 'ownerName', 'title', 'sheet', 'updatedAt'])
    && request.resource.data.title is string && request.resource.data.title.size() <= 200
    && request.resource.data.ownerName is string && request.resource.data.ownerName.size() <= 120
    && request.resource.data.sheet is map
    && request.resource.data.updatedAt == request.time;
  allow update: if request.auth != null
    && resource.data.ownerUid == request.auth.uid
    && request.resource.data.ownerUid == request.auth.uid
    && request.resource.data.keys().hasOnly(['ownerUid', 'ownerName', 'title', 'sheet', 'updatedAt'])
    && request.resource.data.title is string && request.resource.data.title.size() <= 200
    && request.resource.data.sheet is map
    && request.resource.data.updatedAt == request.time;
  allow delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;
}
```

O documento é limitado a 1 MiB pelo próprio Firestore; o app recusa publicar acima de ~800 KB. Partituras longas de aula ficam bem abaixo disso.
