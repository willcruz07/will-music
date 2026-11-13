import type { Explanations } from './types.ts';

export const RHYTHM_READING_EXPLANATIONS: Explanations = {
  'r-pulso': [
    'Pulso é a referência recorrente; andamento indica sua velocidade; compasso organiza os agrupamentos. A escrita permite compartilhar essa organização, mas a música não precisa acentuar todos os tempos da mesma forma.',
    'Pense em passos regulares. Andar mais rápido muda o andamento; contar os passos de três em três muda o agrupamento. São decisões diferentes.',
    'Marque quatro passos iguais e diga 1–2–3–4. Depois mantenha os passos e conte 1–2–3. Você mudou o agrupamento sem precisar acelerar.',
  ],
  'r-subdivisao': [
    'Subdividir é distribuir partes iguais dentro do pulso. Quando a semínima é a referência, cabem duas colcheias ou quatro semicolcheias no mesmo espaço de tempo.',
    'Uma pizza pode ser cortada em dois ou quatro pedaços sem ficar maior. Mais notas dentro do tempo não significam necessariamente um andamento mais rápido.',
    'Mantenha o metrônomo em 60 e faça uma palma por clique, depois duas e depois quatro. Os cliques continuam à mesma distância; só o preenchimento mudou.',
  ],
  'r-sincope': [
    'Síncope desloca a ênfase em relação à organização esperada, frequentemente prolongando um ataque fraco sobre uma posição forte. Contratempo destaca posições entre referências métricas; não se limita sempre à metade exata do pulso.',
    'É como começar uma palavra antes do ponto em que alguém esperava ouvi-la. A surpresa só fica clara porque existe uma referência por baixo.',
    'Conte 1-e-2-e. Bata uma palma no “e” e sustente a voz até o número seguinte. Compare com uma palma curta no “e”, deixando o número em silêncio.',
  ],
  'r-tercinas': [
    'A tercina coloca três durações iguais no espaço normalmente ocupado por duas da mesma figura. Compasso composto já agrupa naturalmente em três; swing é uma interpretação rítmica, não apenas uma tercina escrita.',
    'Você pode dividir um passo em três partes iguais ou dar a duas notas um balanço desigual. Essas sensações se relacionam, mas não são a mesma coisa.',
    'Em cada clique diga “ta-ki-ta” igualmente. Depois toque só a primeira e a terceira partes: é uma aproximação de shuffle. Não use essa proporção como regra fixa para todo swing.',
  ],
  'r-groove': [
    'Groove nasce da relação entre repetição, articulação, intensidade e tempo. Pocket descreve o encaixe percebido entre músicos; tocar relaxado não significa perder o pulso ou atrasar progressivamente.',
    'Pense numa conversa em que todos respeitam os espaços. Se cada pessoa aumenta a voz e ocupa todas as pausas, fica difícil entender o conjunto.',
    'Repita o mesmo padrão com todos os ataques iguais. Depois destaque a caixa e deixe os toques intermediários suaves. O desenho permanece, mas sua hierarquia fica diferente.',
  ],
  'r-polirritmia': [
    'Na polirritmia, divisões diferentes compartilham um mesmo intervalo de tempo. No deslocamento, um desenho muda sua posição em relação ao pulso. Um padrão de três notas não é automaticamente uma polirritmia.',
    'Imagine duas pessoas atravessando a mesma sala: uma dá dois passos e outra três, mas ambas chegam juntas. A distância total é a referência comum.',
    'Conte seis partes iguais. Uma mão toca em 1 e 4; a outra, em 1, 3 e 5. Assim dois e três ataques ocupam o mesmo ciclo.',
  ],
  'r-leitura-figuras': [
    'A escrita rítmica permite registrar ataques e silêncios com durações proporcionais. A pausa faz parte da organização; ela não apaga o tempo que continua passando.',
    'É como deixar uma cadeira vazia numa fila: o lugar continua existindo, mesmo sem alguém sentado nele.',
    'Conte 1–2–3–4, bata palmas em 1, 2 e 4 e deixe o 3 em silêncio. Se você pular a contagem do 3, a próxima palma chegará cedo demais.',
  ],
  'r-dinamica-real': [
    'Dinâmica é a organização das intensidades. Acentos destacam ataques; ghost notes permanecem discretas. Nenhum desses nomes determina sozinho a duração ou o momento da nota.',
    'Na fala, você pode enfatizar uma palavra sem mudar a velocidade da frase. O acento musical funciona de forma parecida.',
    'Toque oito ataques iguais no tempo e destaque apenas o primeiro e o quinto. Faça os demais leves, mas sem removê-los ou aproximá-los dos acentos.',
  ],
  'p-pentagrama': [
    'A pauta organiza alturas visualmente; a clave fixa uma referência para ler as posições. A notação ocidental se desenvolveu ao longo de séculos para registrar e transmitir música com maior precisão.',
    'Pense numa escada desenhada. A clave é a placa que diz o nome de um degrau; a partir dele você descobre os vizinhos.',
    'Na clave de sol, a segunda linha é Sol4. O espaço logo acima é Lá4; a linha seguinte, Si4. Mudar de linha para espaço avança uma letra, não sempre um tom inteiro.',
  ],
  'p-suplementares': [
    'Linhas suplementares estendem a pauta. Claves diferentes permitem escrever regiões diferentes com menos linhas extras; elas não mudam o som do instrumento por si mesmas.',
    'É como trocar a escala de um mapa para mostrar melhor outra região. A legenda precisa ser lida de novo.',
    'O Dó central aparece abaixo da pauta em clave de sol e acima dela em clave de fá. É a mesma altura, representada a partir de referências diferentes.',
  ],
  'p-figuras': [
    'As figuras indicam proporções de duração. Seu tempo em segundos depende do andamento, e sua relação com a contagem depende da figura escolhida como unidade.',
    'Uma metade é sempre metade de um inteiro, mas o inteiro pode durar mais ou menos. A figura diz a proporção, não uma quantidade fixa de segundos.',
    'Com semínima = 60, ela dura um segundo e a mínima dura dois. Com semínima = 120, ambas duram metade desse tempo, mas a mínima ainda vale duas semínimas.',
  ],
  'p-compasso': [
    'A fórmula de compasso informa uma organização escrita de durações. Em compassos simples como 3/4, o numerador mostra três unidades de semínima; em compostos, a percepção do pulso exige observar o agrupamento.',
    'É como organizar uma frase em caixas de tamanho definido. As notas podem preencher a caixa de várias maneiras, sem precisar parar em sua borda.',
    'Em 3/4, um compasso pode ter três semínimas ou uma mínima e uma semínima. A barra separa os grupos; não pede uma pausa adicional.',
  ],
  'p-primeira-leitura': [
    'Ler uma melodia combina reconhecimento de altura, duração e direção. Separar essas tarefas no início reduz a quantidade de decisões feitas ao mesmo tempo.',
    'Antes de ler uma frase em voz alta, você reconhece suas palavras. Na música, conhecer as notas e o ritmo separadamente ajuda a juntar tudo depois.',
    'Em Dó–Ré–Mi com uma pausa, primeiro diga os nomes. Depois bata apenas o ritmo. Por último toque as alturas nesse ritmo, mantendo a contagem durante o silêncio.',
  ],
  'p-acidentes': [
    'A armadura registra alterações de referência; acidentes ocorrentes modificam notas dentro do trecho segundo convenções de validade. Essa distinção evita reescrever a mesma informação continuamente.',
    'A armadura funciona como uma instrução geral; o acidente é uma alteração local. Ao terminar a exceção, volta a valer a instrução geral.',
    'Em Sol maior, Fá é sustenido pela armadura. Um bequadro pode pedir Fá natural naquele compasso; no seguinte, sem nova indicação, volta Fá♯. Observe também notas ligadas.',
  ],
  'p-pontos-ligaduras': [
    'Ponto de aumento acrescenta metade da duração da figura. Ligadura de prolongamento soma notas da mesma altura; ligadura de expressão reúne um gesto de fraseado e não faz essa soma automaticamente.',
    'O ponto aumenta uma porção; a ligadura de prolongamento junta porções sem começar o som de novo. A curva de fraseado indica como conectar a fala musical.',
    'Uma mínima pontuada equivale a três semínimas. Duas semínimas de Dó ligadas sustentam um único Dó por duas semínimas, sem segundo ataque.',
  ],
  'p-sincope': [
    'A leitura de síncopes exige acompanhar o pulso mesmo quando não há ataque nele. Figuras ligadas ajudam a mostrar a duração atravessando divisões métricas.',
    'Imagine uma palavra que começa antes de uma marca e continua depois dela. Você cruza a marca sem repetir a palavra.',
    'Conte 1-e-2-e. Comece uma nota no primeiro “e” e sustente sobre o 2. Continue contando o 2 mentalmente, mesmo sem tocar de novo.',
  ],
  'p-compostos': [
    'Em uma leitura usual de 6/8, seis colcheias se agrupam em dois pulsos de três. A semínima pontuada corresponde a esse pulso composto; o contexto e o andamento ajudam a perceber o agrupamento.',
    'Pense em duas caixas com três peças cada. São seis peças no total, mas você sente dois grupos maiores.',
    'Conte UM-dois-três QUATRO-cinco-seis, marcando o pé só no UM e QUATRO. Compare com 3/4, em que seis colcheias costumam formar três pares.',
  ],
  'p-tercinas': [
    'A indicação de tercina altera a divisão usual: três figuras ocupam o espaço que normalmente caberia a duas equivalentes. O grupo precisa terminar dentro desse espaço, sem aumentar o compasso.',
    'É como repartir a mesma fatia de tempo em três pedaços em vez de dois. A fatia continua do mesmo tamanho.',
    'Em um pulso de semínima, compare duas colcheias com três colcheias em tercina. Use um clique no começo de cada grupo para não confundir mais ataques com mais tempo.',
  ],
  'p-duas-claves': [
    'Pautas alinhadas representam acontecimentos simultâneos. Cada clave tem sua referência de altura, mas a posição horizontal ajuda a identificar quais eventos ocorrem juntos.',
    'É como ler duas falas que acontecem ao mesmo tempo numa cena. Você precisa seguir as duas linhas sem transformar tudo numa única sequência.',
    'Se o baixo sustenta Dó3 por quatro tempos e a melodia toca quatro semínimas, não repita o baixo a cada nota aguda. Ele continua soando enquanto a outra linha se move.',
  ],
  'p-articulacao': [
    'Articulação indica como começar, conectar ou encerrar notas; dinâmica indica intensidade. Os símbolos orientam a interpretação, cuja realização depende também do instrumento e do estilo.',
    'A mesma frase pode ser falada de modo ligado, recortado ou enfático. As palavras continuam iguais; a intenção muda.',
    'Toque quatro Dós com separação curta e depois com ligação suave. Compare ainda um crescendo: aumentar o volume não exige acelerar nem mudar as notas.',
  ],
  'p-roteiros': [
    'Sinais de repetição e retorno organizam a sequência de execução sem exigir que toda a música seja escrita novamente. Casas e indicações de salto precisam ser lidas em conjunto.',
    'É um roteiro com instruções de voltar, passar por uma saída diferente e seguir adiante. Antes de andar, confira o caminho completo.',
    'Num trecho com primeira e segunda casas, toque a primeira casa antes de voltar. Na repetição, pule essa casa e siga pela segunda conforme os sinais.',
  ],
  'p-percussao': [
    'Na escrita para percussão sem altura definida, posições e cabeças de nota podem indicar instrumentos e tipos de ataque. A legenda do arranjo é essencial, pois convenções variam.',
    'A pauta vira um mapa de peças da bateria, e não uma escada de notas como Dó e Ré. A legenda diz quem toca cada sinal.',
    'Identifique bumbo, caixa e chimbal na legenda antes de ler. Uma pausa indica quando não atacar; D/E pode orientar as mãos sem alterar a duração escrita.',
  ],
  'p-assimetricos': [
    'Compassos como 5/8 e 7/8 podem combinar grupos de duas e três colcheias. O agrupamento define pontos de apoio e precisa ser observado na escrita e na escuta.',
    'É como caminhar com uma sequência curta e outra longa. A regularidade está em repetir esse desenho, não em transformar todos os grupos no mesmo tamanho.',
    'Em 5/8 agrupado 2+3, conte UM-dois UM-dois-três. Compare com 3+2: a quantidade total é igual, mas o segundo apoio chega em outro lugar.',
  ],
  'p-transposicao': [
    'Transpor desloca as alturas preservando as relações intervalares e a estrutura rítmica. A escrita precisa ajustar armadura e acidentes, não apenas mover desenhos na pauta.',
    'É como cantar a mesma frase numa região mais confortável. O contorno continua reconhecível, embora cada nota tenha mudado de lugar.',
    'Dó–Ré–Mi, transposto um tom acima, vira Ré–Mi–Fá♯. Usar Fá natural no final mudaria a distância entre as notas e deixaria de preservar a frase original.',
  ],
  'p-conjunto': [
    'A leitura de conjunto combina sua parte com referências das demais vozes. Contagem, entradas, pausas e direção do arranjo continuam importantes mesmo quando sua linha não toca.',
    'É como participar de uma conversa em grupo: você acompanha o assunto durante o silêncio para entrar na hora certa.',
    'Durante quatro compassos de pausa, conte cada compasso e procure um sinal sonoro da entrada. Ao retomar, siga o pulso do conjunto, sem recuperar notas que já passaram.',
  ],
};
