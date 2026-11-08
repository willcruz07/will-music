# Constelação de acordes — design

Data: 07/11/2026 · Módulo novo do Estudo do will-music. Desenho feito em conversa com o autor; os esboços estão em `.superpowers/brainstorm/` (fora do repositório).

## 1. Intenção

O autor estudou rearmonização com uma apostila que listava caminhos possíveis entre acordes: de um C você pode ir para G7, Em7, Bm7(b5), Dm7; chegando no Dm7, pode ir para Gm7, e assim por diante. Cada passo faz sentido pela **função** e pela **sonoridade**, não por estar na escala, e assim uma sequência sai do campo harmônico e continua soando bem.

O módulo transforma essa apostila numa **teia viva e navegável de acordes**, como uma constelação ou um mapa que se explora arrastando e dando zoom (a referência citada foi o Google Earth). O aluno parte de um acorde, vê em volta todos os caminhos que soam com sentido, anda por eles, ouve cada passo e lê, em uma linha, por que aquele movimento funciona.

**Para que serve:** estudo diário de rearmonização. O aluno volta para entender as possibilidades de cada acorde e os caminhos com sonoridades diferentes. É o "segredinho" de músico avançado, ensinado de forma visual e tocável. O app hoje ensina o que é cada acorde (dicionário, formação, campo harmônico, ciclo); este módulo ensina o que fazer com ele.

**Base teórica (decisão do autor):** o raciocínio é o de **centro tonal e função** (tônica, subdominante, dominante), dos **ciclos de quintas e quartas** e da **sonoridade dos acordes**. Não é baseado em escala.

## 2. Objetivos, não objetivos e antiobjetivos

### Objetivos da primeira versão
1. Escolher qualquer acorde (fundamental + tipo) e começar a teia por ele.
2. Ver em volta do acorde em foco os próximos acordes possíveis (a órbita), cada um com a função identificada.
3. Ver, apagado e menor, um anel a mais à frente: para onde cada vizinho leva.
4. Andar pela teia tocando nos acordes da órbita; o acorde escolhido vem para o centro, com a câmera "voando" até ele.
5. Marcar o rastro percorrido e permitir recomeçar.
6. Arrastar, dar zoom e passear por tudo o que já foi aberto; tocar em qualquer acorde aberto o traz de volta ao foco.
7. Explicar cada passo em uma linha curta ("Bm7(b5): tem o mesmo trítono do G7, resolve no C com outra cor").
8. Ouvir cada acorde ao chegar nele e ouvir o rastro inteiro como progressão.
9. Modo alvo (opcional): o aluno escolhe um acorde de destino (ex.: de C para Bb7M) e o app sugere um caminho que tensiona e resolve até lá, passando por acordes maiores, menores e por ciclos diferentes, com a explicação de cada passo.

### Não objetivos (versões seguintes)
- Partir de uma música da biblioteca para rearmonizá-la (decisão do autor: primeira versão só parte de um acorde).
- Desafios, pontuação, conquistas.
- Salvar progressões montadas, exportar para a cifra.
- Visualização 3D.

### Antiobjetivos (seria um fracasso mesmo funcionando)
- Sugerir caminhos que não soam bem ou que um professor de harmonia contestaria. A credibilidade das ligações é o produto.
- Ligações sem explicação: o aluno vê bolinhas, mas não aprende por quê.
- Uma tela poluída: centenas de acordes visíveis ao mesmo tempo, sem foco.
- Lento ou travado no celular.
- Precisar de servidor (o app inteiro roda no aparelho).

## 3. Experiência

### Início
O aluno escolhe o acorde de partida: fundamental (12 notas) e tipo (os tipos que o app já conhece, ver §5). A tela começa só com esse acorde no centro, sem nada em volta. Ao tocar nele, a órbita se abre.

### A teia (decisão do autor: formato "constelação")
- **Centro:** o acorde em foco, maior e destacado.
- **Órbita:** os próximos acordes possíveis, ligados ao centro por linhas. São os únicos em que se pode tocar para andar.
- **Anel de prévia:** um passo a mais à frente, apagado e menor, ligado a cada vizinho. Cada vizinho tem o seu leque completo (não uma única linha). Não é clicável para andar; serve para o aluno ver para onde cada caminho leva.
- **Rastro:** os acordes por onde o aluno passou ficam marcados e ligados pela linha do caminho. Os vizinhos não escolhidos de passos anteriores continuam no mapa, apagados.
- **Câmera:** ao escolher um acorde, ele vem para o centro com animação, e a órbita dele se abre. Conforme a teia cresce, o zoom se afasta. O aluno pode arrastar e dar zoom livremente e tocar em qualquer acorde já aberto para trazê-lo ao foco (a partir dali, o caminho continua daquele ponto).
- **Recomeçar:** limpa o rastro e volta ao acorde de partida.
- **Cores por função:** tônica/repouso, dominante (tensão), subdominante e preparação (ii–V), alterados e secundários. As cores precisam de legenda e não podem ser a única forma de distinguir (rótulo da função em cada bolinha).
- **Uma teia, não uma árvore:** o mesmo acorde alcançado por dois caminhos é a mesma bolinha.

### Explicação do caminho
Abaixo (ou ao lado, no computador) fica o diário do caminho: a progressão percorrida e, para cada passo, uma linha dizendo o que aconteceu e por quê. Exemplos de tom:
- C7M → Am7: "relativo menor: mesma função, cor mais escura."
- Am7 → D7: "D7 é o dominante do G (V7/V): entra o F#, de fora do tom."
- Cm7 → F7 → Bb7M: "ii–V de Bb: o centro tonal mudou para Bb."

Antes de andar, tocar (ou passar o mouse) num vizinho mostra a explicação daquela ligação.

### Modo alvo (decisão do autor)
Opcional, separado do modo padrão "explorar". O aluno escolhe um acorde alvo; o app sugere um caminho até ele, mostrado no diário e destacado na teia. Se o aluno desviar, a sugestão se recalcula a partir de onde ele está. No modo explorar não há caminho sugerido, só o rastro (o autor não quer marcação de rota fora do modo alvo).

O caminho sugerido deve ser musical: tensionar e resolver, preferindo cadeias de ii–V e resoluções pelo ciclo de quartas, e não simplesmente o menor número de passos. Exemplo de C para Bb7M: C7M → Am7 → D7 → Gm7 → C7 → Cm7 → F7 → Bb7M (ou outro igualmente bom).

### Som
Cada acorde toca ao chegar nele (e ao pré-ouvir um vizinho). Um botão toca o rastro inteiro como progressão. Reaproveitar o sintetizador de estudo existente (`useStudySynth`, `chordEvents` em `apps/web/src/study/widgets.tsx`).

### Como tocar o acorde
Cada acorde em foco tem acesso ao diagrama (violão, teclado, cavaquinho) pela ajuda de acorde que o app já tem (`ChordHelp`).

## 4. Onde fica no app

Um módulo próprio do Estudo, com entrada de destaque na tela inicial do Estudo (não é mais uma aba de Ferramentas). Abre em tela cheia ou quase, porque a navegação precisa de espaço. Funciona no celular (toque, pinça para zoom) e no computador (arrastar, roda do mouse).

## 5. O motor de harmonia

O coração do módulo: dado o acorde em foco e o **centro tonal atual**, quais são os vizinhos, com que função e com qual explicação.

### Relações que a primeira versão deve cobrir
Lista mínima (o autor citou explicitamente: dominantes, subdominante, alterados, sétima maior, menores, 11ª, 13ª, diminuto, meio-diminuto, trítono):

| Relação | Exemplo em C | Ideia |
|---|---|---|
| Dominante (V7) e cadência | G7 → C | Resolução pelo ciclo de quartas |
| Substituto pelo trítono compartilhado | Bm7(b5) no lugar de G7 | Mesmo trítono (B–F): G9 sem fundamental |
| Substituto de trítono (subV) | Db7 → C | Mesmo trítono, baixo descendo em semitom |
| ii–V (preparação) | Dm7 → G7, Gm7 → C7 | Subdominante preparando o dominante |
| Acordes relativos e de mesma função | C ↔ Am7 ↔ Em7; F ↔ Dm7 | Compartilham notas |
| Dominantes secundários | A7 (V7/ii), E7 (V7/vi), D7 (V7/V) | Cada acorde do campo ganha o seu V7 |
| Cadeia de dominantes | A7 → D7 → G7 → C | Pelo ciclo de quartas |
| Empréstimo modal / subdominante menor | Fm6, Bb7, Ab7M | Do tom menor homônimo |
| Diminutos de passagem | C#°7 entre C e Dm7 | Liga graus por semitom |
| Tensões e alterações no dominante | G7(9), G7(13), G7(b9), G7(#5) | Mesma função, outra cor |
| Tônica virando dominante | C → C7 → F | Leva o centro para a quarta acima |

### Centro tonal
A teia começa com o centro tonal do acorde de partida. **Minha decisão (Claude):** o app acompanha o centro sozinho: quando o caminho resolve num novo acorde por V→I ou ii–V–I (ex.: Gm7 → C7 → F), o centro passa a ser esse acorde (tonicização), a tela mostra "centro tonal: F", e os vizinhos seguintes são pensados a partir dele.

### Tipos de acorde
Usar e, onde preciso, estender os tipos que o app já conhece (`CHORD_TYPES` em `apps/web/src/lib/chordTheory.ts`; o leitor de cifras `chordNotes` em `apps/web/src/lib/chordNotation.ts` já entende tensões como 7(9), 7(13), 7(b9), 7(#5), 11 e 13). Grafia brasileira: 7M, m7, m7(b5), °7, 7(b9).

### Quantidade de vizinhos
**Minha decisão (Claude):** a órbita mostra os vizinhos mais relevantes, entre 6 e 10, priorizando variedade de funções. Variações de cor do mesmo acorde (G7, G7(9), G7(13)) aparecem agrupadas, não como bolinhas separadas competindo por espaço. O construtor define como agrupar.

## 6. Decisões do autor (resumo)
- Módulo separado, imersivo e com cara de jogo, no Estudo.
- Formato constelação: centro, órbita clicável, um anel de prévia apagado.
- Navegação livre por arrastar e zoom; tocar num acorde aberto o traz ao foco.
- Só o rastro fica marcado; botão de recomeçar.
- Explicação curta a cada passo.
- Modo alvo opcional com caminho sugerido.
- Base em centro tonal, função, ciclos e sonoridade, não em escala.
- Primeira versão parte só de um acorde escolhido; sem música da biblioteca.
- A ferramenta "Ciclo de quintas" passou a se chamar "Ciclo de quintas e quartas" (já feito; separado deste módulo).

## 7. Decisões minhas (Claude), para o autor conferir
- Nome do módulo (escolhido com o autor): **Constelação de acordes**; na entrada do Estudo pode aparecer só "Constelação", com a descrição "Explore caminhos de rearmonização".
- Centro tonal acompanhado automaticamente (§5).
- Órbita com 6 a 10 vizinhos, variações de cor agrupadas (§5).
- Visual em 2D (sem 3D), leve para celular.
- Sem salvar nada na primeira versão: ao sair, a teia recomeça.
- Toque em dois tempos no celular: o primeiro toque num vizinho o seleciona (toca o som e mostra a explicação da ligação); um segundo toque, ou o botão "Ir", anda até ele. No computador, passar o mouse pré-visualiza e o clique anda.
- O centro tonal pode ser maior ou menor. Num centro menor entram as relações do tom menor (iiø–V7–i, V7 da menor harmônica, VI e VII emprestados).
- Grafia das notas segue o centro tonal (tons com bemóis escrevem Bb, Eb; com sustenidos, F#, C#), usando os utilitários de grafia que o app já tem.

## 8. Deixado para o construtor
- Tecnologia de desenho e de câmera (SVG, canvas, biblioteca de pan e zoom) e o algoritmo de posicionamento das bolinhas.
- Como representar as relações e o modelo de dados do motor.
- Algoritmo de busca do modo alvo, desde que o caminho seja musical (§3).
- O texto exato das explicações, no tom do app (frases curtas, voz ativa).
- Layout no celular versus computador.
- Testes do motor de harmonia (as ligações precisam de testes que conferem a teoria, ex.: Bm7(b5) e G7 compartilham B e F).
