# Catálogo comunitário: opções, avaliações e cifras públicas

Substitui a edição da cifra principal descrita em [firebase-catalogo-edicao.md](firebase-catalogo-edicao.md). Desenho completo: [superpowers/specs/2026-11-16-catalogo-comunitario-design.md](superpowers/specs/2026-11-16-catalogo-comunitario-design.md).

## Como funciona

- **Abrir uma cifra do catálogo** continua custando 1 leitura: a principal, as opções da comunidade e as avaliações estão no mesmo documento `cifras/{id}`.
- **Editar uma cifra do catálogo** oferece dois destinos: *Só na minha biblioteca* (padrão, funciona offline) ou *Enviar como opção para a comunidade*. A cifra principal nunca é alterada.
- **Opções**: até 3 por pessoa por música; texto igual à principal ou a outra opção é recusado. O autor pode reenviar (substitui a própria opção) ou apagar a sua.
- **Avaliações**: 1 a 5 estrelas e comentário opcional de até 200 caracteres, uma por pessoa por versão. Ninguém avalia a própria versão.
- **Destaque**: a versão com maior média entre as que têm pelo menos 3 avaliações abre selecionada; sem isso, abre a principal.
- **Cifra nova**: no editor, uma cifra que não veio do catálogo pode ser *Publicada no catálogo* (pede estilo; título e artista vêm da música). O documento leva `chordPro` e também `content` com o mesmo texto, para o Alt7 mostrar. Quem publicou pode corrigir a própria cifra enquanto não houver opções de outras pessoas.

## Campos novos em `cifras/{id}`

```text
chordOptions.<uid>  = { author: { uid, name, photo }, options: { <optionId>: { chordPro, createdAt, updatedAt } } }
chordRatings.<uid>  = { name, photo, items: { main | <uid>_<optionId>: { stars, comment?, at } } }
author, origin: 'will-music', createdAt        // só em cifras publicadas pelo will-music
```

As entradas são agrupadas pelo uid de quem grava: assim a regra confere com `hasOnly([request.auth.uid])` que cada pessoa só mexe nas próprias opções e avaliações.

## Regras do Firestore (somar ao bloco `cifras` existente)

Antes de aplicar, confira no Console:

1. **`allow update` já existente em `cifras`.** Regras se somam por OU: se já houver um `update` amplo (qualquer autenticado), as restrições abaixo não protegem nada. Nesse caso, restrinja o `update` existente ao predicado de administrador do Alt7.
2. **O Alt7 grava `cifras` com `set` sem `merge`?** Se sim, uma edição feita pelo Alt7 apaga `chordOptions` e `chordRatings`. Isso precisa ser ajustado no Alt7 (usar `update` ou `set(..., { merge: true })`).

```text
match /cifras/{id} {
  function wmSigned() {
    return request.auth != null && request.auth.token.email_verified == true;
  }
  function wmChanged() {
    return request.resource.data.diff(resource.data).affectedKeys();
  }
  function wmOptionsOk() {
    let before = resource.data.get('chordOptions', {});
    let after = request.resource.data.get('chordOptions', {});
    return after.diff(before).affectedKeys().hasOnly([request.auth.uid])
      && after.size() <= 20
      && (!(request.auth.uid in after) || (
        after[request.auth.uid].author.uid == request.auth.uid
        && after[request.auth.uid].options is map
        && after[request.auth.uid].options.size() >= 1
        && after[request.auth.uid].options.size() <= 3));
  }
  function wmRatingsOk() {
    let before = resource.data.get('chordRatings', {});
    let after = request.resource.data.get('chordRatings', {});
    return after.diff(before).affectedKeys().hasOnly([request.auth.uid])
      && (!(request.auth.uid in after) || after[request.auth.uid].items is map);
  }

  // Opções e avaliações da comunidade: cada pessoa só grava na própria entrada.
  allow update: if wmSigned()
    && wmChanged().hasOnly(['chordOptions', 'chordRatings'])
    && wmOptionsOk()
    && wmRatingsOk();

  // Quem publicou pelo will-music corrige a própria cifra enquanto só houver opções suas.
  allow update: if wmSigned()
    && resource.data.get('origin', '') == 'will-music'
    && resource.data.author.uid == request.auth.uid
    && resource.data.get('chordOptions', {}).keys().hasOnly([request.auth.uid])
    && wmChanged().hasOnly(['chordPro', 'content'])
    && request.resource.data.chordPro is string
    && request.resource.data.chordPro.size() > 0
    && request.resource.data.chordPro.size() <= 20000
    && request.resource.data.content == request.resource.data.chordPro;

  // Cifra pública nova, assinada por quem cria.
  allow create: if wmSigned()
    && request.resource.data.keys().hasOnly(['title', 'artist', 'style', 'key', 'chordPro', 'content', 'author', 'origin', 'createdAt'])
    && request.resource.data.origin == 'will-music'
    && request.resource.data.author.uid == request.auth.uid
    && request.resource.data.title is string && request.resource.data.title.size() > 0 && request.resource.data.title.size() <= 200
    && request.resource.data.artist.name is string && request.resource.data.artist.name.size() > 0
    && request.resource.data.style is string && request.resource.data.style.size() > 0
    && request.resource.data.chordPro is string && request.resource.data.chordPro.size() > 0 && request.resource.data.chordPro.size() <= 20000
    && request.resource.data.content == request.resource.data.chordPro
    && request.resource.data.createdAt == request.time;
}
```

O que as regras não conseguem conferir (sem percorrer chaves aleatórias) e fica no app: estrelas de 1 a 5, comentário até 200 caracteres, texto de cada opção até 20 000 caracteres, duplicidade de texto, não avaliar a própria versão e o teto de ~700 KB do documento. Como cada pessoa só grava na própria entrada, um cliente adulterado só estraga os próprios dados.

## Validação

Typecheck e build do app. Gravações reais dependem das regras acima aplicadas no Console e de validação no navegador com duas contas (autor e avaliador).
