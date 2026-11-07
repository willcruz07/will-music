# Fase 0 — relatório de qualidade dos acordes

Gerado em 2026-11-07. Modelos: ChordMini (acordes) e S-KEY (tom), rodando em CPU com o motor `@will-music/engine`.

**Cobertura média: 0%** (meta 70%). **Abaixo da meta**: testar Essentia.js; a V1 segue com a cifra como rascunho editável.

> Atenção: há referências em **rascunho**, ainda não confirmadas pelo músico.

| Música | Tom ref. | Tom previsto | Tom | Cobertura | Ruído | Acordes ref/prev | Duração | Processamento |
|---|---|---|---|---|---|---|---|---|
| Boulevard of Broken Dreams — Green Day (rascunho) | F menor | G# maior | relativo | 0% | 100% | 1/160 | 4:48 | 8.6 s |
| Imperfeito — Coral Canto Jovem e Rayssa Andreoli (rascunho) | A maior | A maior | certo | 0% | 100% | 1/82 | 4:55 | 8.3 s |
| Ninguém Explica Deus — Preto no Branco ft. Gabriela Rocha (rascunho) | C maior | G maior | quinta | 0% | 100% | 1/128 | 6:32 | 16.8 s |
| Olhos Coloridos — Seu Jorge e Sandra de Sá (rascunho) | C maior | F# menor | errado | 0% | 100% | 1/83 | 6:07 | 10.3 s |
| Primeiros Passos — Ton Carfi (rascunho) | G maior | G maior | certo | 0% | 100% | 1/73 | 3:28 | 5.6 s |

Cobertura = parte da sequência de referência reencontrada na ordem (LCS). Ruído = acordes previstos que não estão na referência. Comparação por fundamental + maior/menor.

## Boulevard of Broken Dreams

**Referência:** N.C.

**Previsto:** F A# G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# C# G# D# Fm C# G# D# Fm C# G# D# Fm C# G# C Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# Fm G# D# A# C# G# D# Fm C# G# D# Fm C# G# D# Fm C# G# C Fm G# D# A# Fm G# D# A# C# G# D# Fm C# G# D# Fm C# G# D# Fm G# C Fm G# D# A# Fm G# D# A# C# G# D# Fm C# G# D# Fm C# G# D# Fm C# G# C Fm C# D# Dm E F C# D# Dm G# E F C# D# Dm G# E F C# D#

## Imperfeito

**Referência:** N.C.

**Previsto:** A C# F#m Dm A C# F#m Dm A C# F#m Dm A C# F#m D A C# F#m A Dm A C# F#m A Dm A C# F#m Dm F#m F A B A D B D A C# F#m Dm A C# F#m Dm A F#m C# F#m Dm A C# F#m Dm A C# F#m D Dm A C# F#m A Dm A C# F#m Dm A C# F#m Dm A C# D Dm A C#m D E A

## Ninguém Explica Deus

**Referência:** N.C.

**Previsto:** G Em G C G Am G Em C Em Am G Em G Em C G Am D C D C Em Am C F D G Em D C G C D G D Em D Em C G Am D G Em C G Am D G Em G C G Am C G Em G C G Am G C D Em D Am G F D G Em D C G C D G D G C G Am G Em D C G Am C Em Dm G C Em Am C G Em C G D G Em D C G Am D G D Em D C G Am D G Em G Em G C G Am G D

## Olhos Coloridos

**Referência:** N.C.

**Previsto:** C#m F#m Bm D F#m Bm F#m C#m F#m D Bm F#m C#m Bm D F#m D F#m D C#m Bm F#m C#m F#m C#m Bm F#m C#m Bm F#m Bm F#m Bm F#m C#m F#m C#m Bm C#m D C#m Bm D C#m Bm F#m C#m Bm F#m Bm F#m Bm F#m Bm F#m D A Bm C#m Bm F#m Bm C#m F#m Bm F#m Bm F#m D F#m Bm F#m Bm F#m Bm F#m D Bm F#m Bm F#m Bm F#m

## Primeiros Passos

**Referência:** N.C.

**Previsto:** C G C G Cm G C D G C D C D C D C D B Em C D B Em C D G C D G C D G D G Am C Em G C G D G D C G D G C D B Em C D B Em G A C D G C D G C G C G Am D G Am D G
