# Avaliação das trilhas de estudo

Data: 11/11/2026. Escopo: `/estudo/trilha/:id`, aulas, catálogo, reprodução dos exemplos e componentes de conteúdo. Revisão por leitura do código e dos conteúdos; sem validação visual ou auditiva no navegador. Nenhum comportamento da aplicação foi alterado nesta avaliação.

## Base atual

São 9 trilhas e 81 aulas, distribuídas em quatro níveis:

| Trilha | Iniciante | Intermediário | Avançado | Pro | Total |
|---|---:|---:|---:|---:|---:|
| Harmonia | 6 | 7 | 7 | 4 | 24 |
| Ritmo | 2 | 2 | 1 | 1 | 6 |
| Escalas | 1 | 2 | 2 | 1 | 6 |
| Improvisação | 1 | 3 | 2 | 1 | 7 |
| Canto | 4 | 4 | 3 | 1 | 12 |
| Violão e guitarra | 2 | 3 | 1 | 1 | 7 |
| Teclado | 2 | 1 | 1 | 1 | 5 |
| Bateria | 2 | 2 | 1 | 1 | 6 |
| Estilos | 2 | 3 | 2 | 1 | 8 |

A arquitetura de blocos já oferece texto, listas, dicas, cifras, progressões transponíveis, escalas, intervalos, ritmos, tablatura e exercícios. O progresso é uma marcação manual no localStorage; não é uma avaliação de domínio. Há retomada da última aula e navegação anterior/próxima.

## Correções prioritárias identificadas

1. `h-campo-maior`: a tríade do VII grau é diminuta (B–D–F), não meio-diminuta. O nome meio-diminuto exige a sétima menor: B–D–F–A. A aula mistura as duas definições, embora a lista de tétrades posterior esteja correta.
2. `h-triades`: fundamental do acorde e tônica do centro tonal precisam ser distinguidas. Em Dm dentro de C maior, D é a fundamental do acorde; C pode continuar sendo a tônica do contexto.
3. `h-menor-relativo`: o exemplo chamado de campo menor natural mistura tríades com `iiø`, que o conversor transforma em tétrade. Separar explicitamente os dois campos.
4. `h-tensoes`: frases como “o que não pode faltar é a terça e a sétima” precisam ser contextualizadas. Tríades, acordes sus, power chords e omissões intencionais não seguem essa instrução. Extensões também não são independentes da melodia, do registro e do destino harmônico.
5. `t-inversoes`: inversão da disposição da mão direita não é necessariamente inversão do acorde completo. A inversão é determinada pelo baixo efetivamente ouvido. Mostrar baixo e vozes superiores separadamente.
6. `v-arpejos-triades`: três posições de uma tríade são estado fundamental, primeira e segunda inversões; a expressão “três inversões” é imprecisa.
7. `r-tercinas`: a aproximação por tercinas ajuda a iniciar o swing, mas não deve ser descrita como proporção fixa válida em qualquer andamento e execução.
8. `r-groove` e `b-ghost-independencia`: o áudio atual não diferencia intensidade entre acento e ghost note. `rhythmEvents` trata `x`, `X` e `o` como eventos iguais, sem dinâmica por toque.
9. Tablaturas: `tabEvents` transforma cada coluna ocupada em uma colcheia e não preserva pausas horizontais ou técnicas como bend e slide. Não apresentar a reprodução como interpretação completa da escrita.
10. `h-quartal-clusters`: uma cifra com 11 ou 9 não garante disposição quartal ou cluster; o exemplo precisa especificar as alturas e oitavas do voicing.

Esses itens são achados desta avaliação, ainda não correções implementadas.

## Organização pedagógica comum

Manter os quatro níveis, mas dar a cada aula: objetivo observável, conhecimentos prévios, explicação, exemplo visual e sonoro, prática em passos e critério de autoavaliação. Um pequeno desafio de revisão pode complementar a marcação manual, sem bloquear o acesso ao conteúdo.

Separar “li a aula” de “consigo executar”. Mostrar próxima aula recomendada e ligações para ferramentas com parâmetros adequados. Não impor tempo mínimo de leitura nem confundir progresso com proficiência.

## Melhorias por trilha

### Harmonia

Reordenar fundamentos para que intervalos básicos antecedam a formação dos acordes. Acrescentar notas comuns, movimento de cada voz, linha de baixo, pedal, acordes sus e baixo externo. Comparar o mesmo trecho em três versões: simples, com inversões e rearmonizado. Explicar tonicização, modulação e empréstimo como fenômenos diferentes.

Usar Harmonia Ilustrada como referência de exploração: melodia conectando os acordes, relações por notas comuns, transformações de tríades, simetria dos diminutos e aumentados, pontes entre centros e substituição de trítono. A notação abreviada e os mapas do livro precisam ser traduzidos para a terminologia explícita do aplicativo; não virar regras universais de resolução. Produzir exemplos próprios.

### Ritmo

Acrescentar figuras e pausas, unidade de tempo, anacruse, ligaduras, acentos, compassos simples e compostos, equivalência de pulso e exercícios de leitura. Depois, compassos mistos, polirritmia, deslocamento e modulação métrica. Primeiro garantir que o som represente a dinâmica ensinada.

### Escalas

Reduzir concentração de exemplos extensos em uma única aula. Comparar modos com a mesma tônica, sobre pedal e com uma frase característica. Distinguir escala, modo, tonalidade e coleção de notas. Associar cada escala a acordes e resoluções concretas, sem equivalências automáticas. Contextualizar tradições musicais sem reduzir raga ou maqam a uma escala temperada.

### Improvisação

Acrescentar ritmo e silêncio antes de expansão de vocabulário. Exercícios de chamada/resposta, desenvolvimento de motivos, guia de terças/sétimas, variação rítmica, transcrição curta e aplicação em 4–8 compassos. Explicar que pentatônicas não eliminam toda possível tensão com a harmonia.

### Voz

Acrescentar frases cantáveis com referência transponível e registro confortável, afinação em contexto, entradas após pausas, percepção de graus, segunda voz e leitura melódica. Diferenciar extensão observada, tessitura e classificação. Revisar descrições excessivamente categóricas sobre mecanismos vocais com uma pessoa qualificada; manter técnicas avançadas como explicação e estudo acompanhado, sem prometer diagnóstico pelo microfone.

### Violão e guitarra

Manter fundamentos comuns, mas oferecer percursos distintos. Violão: dedilhado, independência entre baixo e melodia, bossa, samba, condução de baixos e arranjo solo. Guitarra: abafamento, palhetada, articulação, tríades por grupos de cordas, arpejos e acompanhamento em banda. Para ambos: leitura do braço, intervalos, ligação entre posições, inversões, voicings e tensões com indicação das notas omitidas.

### Teclado

Expandir significativamente: orientação no teclado, dedilhado, coordenação, leitura nas claves de sol e fá, tríades/tétrades, baixo versus inversão, shells, rootless, drop 2, quartais, acompanhamento solo versus banda e reharmonização respeitando a melodia. Mostrar mãos, alturas e oitavas nos exemplos; cifras sozinhas não ensinam disposição de vozes.

### Bateria

Acrescentar postura, leitura de percussão, coordenação progressiva, acentos e dinâmica audível. Expandir rudimentos, viradas com retorno ao primeiro tempo e estudo por ciclos de 4/8 compassos. Separar exercício técnico de aplicação musical. A reprodução de três sons atual é uma aproximação, não uma bateria completa com todas as articulações.

### Estilos

Transformar cada apresentação curta em sequência prática: contexto, pulso, levada, harmonia, articulação, arranjo e exercício final. Acrescentar blues e jazz, além de baião/xote e choro como aplicações úteis ao cavaquinho. Mostrar versões simples e enriquecidas; gêneros não são definidos apenas por uma progressão ou por acordes com tensão.

## Nova trilha: cavaquinho

Instrumentos, com percurso próprio:

- Iniciante: partes do instrumento, afinação brasileira D–G–B–D do grave ao agudo com oitavas explícitas, postura, palheta, cordas/casas, primeiros acordes e troca com pulso.
- Intermediário: levadas, abafamentos, síncopes, pestanas, tríades, tétrades, inversões e ii–V–I.
- Avançado: tensões possíveis em quatro cordas, omissões, encadeamento, dominantes secundários, diminutos, samba/pagode e introdução ao choro.
- Pro: acompanhamento com melodia na voz superior, contrapontos, improvisação, transposição e arranjo.

Reaproveitar os diagramas existentes. Tornar afinação e número de cordas parâmetros dos blocos de escala/tablatura: hoje a aula usa seis cordas de guitarra. O áudio continuará sendo referência sintetizada; não prometer timbre real de cavaco.

## Nova trilha: leitura de partituras

Recomenda-se trilha própria em Teoria e harmonia, integrada às trilhas de instrumento:

1. Iniciante: pentagrama, linhas/espaços, direção e altura, claves de sol/fá, linhas suplementares, figuras e pausas, duração relativa, compasso, pulso e primeiras melodias.
2. Intermediário: armadura, acidentes e sua validade, tom/semitom na escrita, ligadura de prolongamento versus expressão, ponto de aumento, anacruse, síncope, tercinas, compassos simples/compostos e leitura nas duas claves.
3. Avançado: vozes simultâneas, grande pauta, dinâmica, articulação, repetições, casas, D.C./D.S./coda, oitavação, mudanças de andamento/compasso e notação de bateria.
4. Pro: leitura à primeira vista, polirritmia, compassos assimétricos, quiálteras, transposição e leitura de conjunto/coral com aplicações progressivas.

Criar um bloco de notação com fragmentos MusicXML próprios, reutilizando ScoreView/OSMD sob demanda. Reprodução e imagem devem partir dos mesmos dados de notas, pausas e durações. Exercícios: identificar nota, completar compasso, comparar escrita e som, bater o ritmo e ler pequenas frases. Começar sem avaliação por microfone.

## Impacto e ordem proposta

1. Corrigir terminologia e discrepâncias entre texto e som; preservar IDs e marcações existentes.
2. Adicionar estrutura pedagógica opcional às aulas e melhorar navegação por pré-requisitos.
3. Implementar bloco leve de notação e primeira sequência de leitura; expandir gradualmente até avançado/pro.
4. Adicionar cavaquinho e suporte contextual de instrumento nos exemplos.
5. Aprofundar instrumentos, voz, estilos e conexões com ferramentas.

Conteúdo e pequenas interações têm custo baixo de processamento. Notação exige atenção ao carregamento: importar o visualizador sob demanda, limitar fragmentos por aula, evitar dezenas de instâncias e adaptar à largura mobile. Não requer modelo de IA, processamento de MP3 ou novas gravações de faixas em IndexedDB. MusicXML pode ser conteúdo estático do aplicativo. Mais conteúdo aumenta o pacote/precache; revisar a política offline e carregar catálogos por trilha se o volume justificar.

Complexidade global média a alta pelo trabalho editorial, exemplos e coerência entre escrita/som, não pela necessidade de uma nova infraestrutura. Entregar por etapas permite avaliar a didática antes de multiplicar as aulas.
