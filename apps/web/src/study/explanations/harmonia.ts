import type { Explanations } from './types.ts';

export const HARMONY_EXPLANATIONS: Explanations = {
  'h-notas': [
    'Na afinação de doze sons por oitava usada neste app, os nomes organizam alturas que podem aparecer em registros graves ou agudos. Esse sistema é uma referência de estudo, não a única maneira de organizar sons no mundo.',
    'Pense numa escada: cada degrau é um semitom; subir dois degraus é subir um tom. A oitava leva você a outra região, mas a nota recebe novamente o mesmo nome.',
    'No teclado, Mi e Fá são vizinhos: um semitom. Dó e Ré têm Dó♯ entre eles: dois semitons. No violão, cada casa avança um degrau.',
  ],
  'h-escala-maior': [
    'Uma escala organiza notas em relação a uma referência. A escala maior participa da linguagem tonal de muito repertório ocidental; os graus permitem descrever sua estrutura sem depender de uma tonalidade específica.',
    'É como uma receita de distâncias. Você pode começar em outro lugar, mas precisa conservar o tamanho dos passos para reconhecer a mesma receita.',
    'Dó maior começa C–D–E; Sol maior começa G–A–B. Em ambos, os dois primeiros passos são tons. Em Sol, Fá♯ preserva o semitom antes de chegar novamente a Sol.',
  ],
  'h-triades': [
    'As tríades reúnem três classes de notas em intervalos de terça. Maior, menor, diminuta e aumentada descrevem a estrutura do acorde, não uma emoção obrigatória de quem ouve.',
    'Imagine três ingredientes. Alterar um deles pode mudar bastante o sabor, mesmo mantendo os outros dois. O resultado também depende do ritmo e dos sons ao redor.',
    'C contém Dó–Mi–Sol. Cm mantém Dó e Sol, mas troca Mi por Mi♭. Toque os dois devagar e procure ouvir justamente essa nota que mudou.',
  ],
  'h-campo-maior': [
    'O campo harmônico reúne acordes construídos com as notas de uma escala. Ele ajuda a analisar relações frequentes no repertório tonal, sem proibir acordes de fora dessa coleção.',
    'É como uma família de ingredientes disponíveis na mesma cozinha. Eles combinam de várias formas, e um ingrediente de fora também pode entrar com intenção.',
    'Em Dó maior, Dm usa Ré–Fá–Lá, todas da escala. D maior inclui Fá♯: ele é externo ao campo, mas pode preparar G em uma progressão.',
  ],
  'h-progressoes-basicas': [
    'Progressões descrevem a ordem dos acordes e sua relação com o centro tonal. Sequências recorrentes aparecem em repertórios diferentes; harmonia semelhante não torna duas músicas iguais.',
    'Os acordes são lugares; a progressão é o caminho. A mesma rota pode ser percorrida com outro ritmo, outra melodia e outra sensação.',
    'Em Dó, I–V–vi–IV vira C–G–Am–F. Em Sol, vira G–D–Em–C. Os nomes mudam, mas cada acorde continua ocupando a mesma posição no caminho.',
  ],
  'h-menor-relativo': [
    'Tonalidades relativas compartilham a armadura, mas possuem centros diferentes. Na prática tonal menor, sexto e sétimo graus podem variar conforme a harmonia e a direção da melodia.',
    'É como usar as mesmas palavras para contar histórias com personagens principais diferentes: as palavras não determinam sozinhas quem está no centro.',
    'C maior e A menor natural usam as mesmas notas. Termine uma frase em C e depois em Am. Em A menor, experimente E7–Am: Sol♯ cria uma chegada diferente de Em–Am.',
  ],
  'h-tetrades': [
    'Uma tétrade acrescenta uma quarta classe de nota à estrutura por terças. As sétimas ampliam as diferenças entre acordes e aparecem em muitas práticas de acompanhamento, além do jazz.',
    'Se a tríade é um desenho básico, a sétima acrescenta um traço que muda sua expressão. É preciso observar qual sétima foi acrescentada.',
    'C7M contém Si; C7 contém Si♭. A diferença é só um semitom nessa voz, mas C7 pode preparar F, enquanto C7M costuma sustentar a cor de Dó maior.',
  ],
  'h-funcoes': [
    'Função harmônica descreve o papel de um acorde dentro de uma frase tonal. Uma cadência é um gesto de chegada ou fechamento; sua força depende também de baixo, melodia e ritmo.',
    'Pense numa história com saída, expectativa e chegada. O mesmo personagem pode cumprir outro papel em outra história; o acorde também depende do contexto.',
    'Toque C–F–G7–C e pare no G7 antes de repetir. Compare a expectativa dessa parada com a sensação de terminar em C. Não é o volume que produz essa diferença.',
  ],
  'h-251': [
    'O ii–V–I reúne preparação e chegada por relações de quinta. Ele é muito explorado no jazz e em canções com harmonia tonal, mas não pertence exclusivamente a um estilo.',
    'É uma pequena viagem em três etapas: você se afasta, vê a chegada se aproximar e finalmente pousa. As notas internas ajudam a ligar essas etapas.',
    'Em Dm7–G7–C7M, ouça Dó descendo para Si e Fá descendo para Mi. Cantar essas linhas lentamente mostra o movimento melhor do que apenas decorar os nomes.',
  ],
  'h-inversoes': [
    'Inversão depende de qual nota do acorde está no baixo. Condução de vozes acompanha o movimento de cada linha, recurso desenvolvido na escrita de várias vozes e aplicado também ao acompanhamento.',
    'É como reorganizar as pessoas da mesma equipe e acompanhar o caminho de cada uma. A equipe pode continuar a mesma, mas quem está na base muda o resultado.',
    'C, C/E e C/G contêm Dó–Mi–Sol. Toque cada um com o baixo indicado. Depois experimente C–G/B–Am: o baixo faz Dó–Si–Lá, uma linha fácil de perceber.',
  ],
  'h-dominantes-secundarios': [
    'Um dominante secundário prepara um acorde diferente da tônica principal. Ele introduz uma referência local, frequentemente com notas externas, sem obrigar a música a mudar definitivamente de tom.',
    'É como uma placa que indica uma parada no meio da viagem. A parada recebe destaque, mas ainda não virou o destino final.',
    'Em C–A7–Dm–G7–C, A7 aponta para Dm. Seu Dó♯ ajuda a conduzir a Ré. O retorno a C mostra que essa preparação local pode acontecer dentro de Dó maior.',
  ],
  'h-ciclo-quintas': [
    'O ciclo organiza as doze classes de altura por quintas ou, no sentido contrário, quartas. Ele permite comparar armaduras, transposições e movimentos de fundamentais.',
    'Pense num relógio em que cada passo segue sempre a mesma distância musical. Ele é um mapa de relações; não obriga a música a seguir todos os seus pontos.',
    'C→G→D avança por quintas; C→F→B♭, por quartas. Dm→G→C também move as fundamentais por quartas, mas a qualidade de cada acorde precisa ser observada separadamente.',
  ],
  'h-intervalos': [
    'O nome de um intervalo combina quantidade de letras e distância sonora. Essa escrita permite compreender a função de uma nota, inclusive quando duas grafias soam iguais no temperamento do app.',
    'É como distinguir o endereço do trajeto: saber quantos passos foram dados não conta sozinho por quais ruas você passou.',
    'Dó–Fá♯ é quarta aumentada; Dó–Sol♭ é quinta diminuta. Aqui ambos têm seis semitons, mas as letras mostram relações diferentes dentro da escrita musical.',
  ],
  'h-tritono': [
    'O trítono corresponde a seis semitons. Na substituição de dominante, dois acordes separados por trítono podem compartilhar, por equivalência sonora, as notas de terça e sétima que orientam a resolução.',
    'É como chegar ao mesmo lugar por outra rua. Algumas pistas da chegada permanecem, enquanto o baixo escolhe um caminho diferente.',
    'G7 contém Si e Fá; D♭7 contém Fá e Dó♭, que soa como Si neste sistema. Compare G7–C e D♭7–C, observando o baixo por semitom na segunda versão.',
  ],
  'h-emprestimo-modal': [
    'O empréstimo modal traz acordes de um modo paralelo, mantendo a referência de tônica. É uma maneira de explicar certas mudanças de cor sem presumir modulação.',
    'É como iluminar a mesma sala com outra luz: você continua no mesmo lugar, mas percebe outro ambiente.',
    'Em C–F–Fm–C, Fm traz Lá♭, uma nota de Dó menor. Ouça Lá descendo para Lá♭ e depois para Sol: essa pequena linha ajuda a entender a mudança de cor.',
  ],
  'h-tensoes': [
    'Nona, décima primeira e décima terceira ampliam a descrição do acorde. O nome não obriga a executar todas as notas; registro, melodia e omissões influenciam a clareza.',
    'São cores acrescentadas ao desenho. Mais cores não tornam o desenho automaticamente melhor; importa onde cada uma aparece.',
    'Em C7M(9), Ré é a nona. Compare C–E–G–B com C–E–G–B–D em registro confortável. Depois aproxime Ré de Mi e perceba como a disposição muda o atrito.',
  ],
  'h-modos-centro-tonal': [
    'Na abordagem modal moderna, a tônica e os intervalos característicos definem a referência. Os nomes herdados de tradições históricas não significam que a prática atual reproduza a música da Grécia antiga.',
    'Não basta começar a caminhada em outro degrau: seu ouvido precisa reconhecer uma nova casa. A nota de repouso e o acompanhamento ajudam a mostrar essa casa.',
    'Sobre um Ré sustentado, use D–E–F–G–A–B–C e termine em Ré. O Si natural distingue Ré dórico de Ré menor natural, mesmo usando as notas de Dó maior.',
  ],
  'h-diminutos': [
    'Acordes diminutos podem ligar destinos por movimentos pequenos entre vozes. O diminuto com sétima tem simetria sonora, mas sua função depende da grafia e do contexto.',
    'Ele pode agir como uma ponte curta: seu valor está em ligar as margens, não em obrigar você a parar no meio.',
    'Em C–C♯°7–Dm, o baixo sobe Dó–Dó♯–Ré. Compare a sequência com C–Dm e mantenha a mesma duração total para ouvir a passagem sem deslocar a chegada.',
  ],
  'h-jazz': [
    'Voicing é a disposição concreta das notas; turnaround é um caminho que conduz à repetição ou nova frase. Esses recursos participam do jazz, cuja linguagem também envolve ritmo, articulação e interação.',
    'A cifra dá os ingredientes; o voicing decide como servi-los. O turnaround prepara a próxima rodada da conversa.',
    'Toque C7M–A7–Dm7–G7 e repita. Escolha posições próximas em vez de saltar todo o acorde. Repare como G7 convida a voltar ao início.',
  ],
  'h-aproximacoes': [
    'Cromatismo usa passos de semitom, inclusive notas externas ao tom. A ligação de um acorde ou linha com seu destino ajuda a explicar por que essa passagem faz sentido.',
    'É como se aproximar de uma porta pelo degrau imediatamente anterior. O ouvido reconhece a intenção quando você mostra onde queria chegar.',
    'Toque D♭7–C7M e observe as vozes que descem. Compare com uma passagem de apenas uma nota, Ré♭–Dó: cromatismo não exige mover o acorde inteiro em bloco.',
  ],
  'h-rearmonizacao': [
    'Rearmonizar é propor outro acompanhamento harmônico para uma melodia. Não é simplesmente acrescentar acordes: é necessário preservar relações com a frase e a forma.',
    'Pense na mesma cena com outro cenário. A personagem principal continua reconhecível, mas o que está ao redor muda a interpretação.',
    'Sustente Dó na melodia e compare C, Am e F por baixo: Dó é fundamental de C, terça de Am e quinta de F. A mesma nota passa a ter outro papel.',
  ],
  'h-quartal-clusters': [
    'Disposição quartal empilha intervalos de quarta; cluster aproxima notas vizinhas. São maneiras de organizar as vozes, não qualidades garantidas por uma cifra com 9 ou 11.',
    'Imagine os mesmos objetos espalhados na mesa ou agrupados bem perto. A distância entre eles muda a textura que você percebe.',
    'Compare Ré3–Sol3–Dó4–Fá4 com Dó4–Ré4–Mi4. O primeiro desenho destaca quartas; o segundo reúne notas próximas. Ouça cada disposição antes de escolher uma cifra para o contexto.',
  ],
  'h-upper-structures': [
    'Uma upper structure usa uma estrutura reconhecível nas vozes superiores sobre outra base harmônica. Ela organiza extensões em um desenho prático, mantendo a função do baixo e das notas-guia.',
    'É como construir um andar superior com uma forma conhecida. O piso de baixo continua influenciando como o conjunto é entendido.',
    'Sobre Dó–Mi–Si♭ no grave e médio, acrescente Ré–Fá♯–Lá no agudo. A tríade de Ré fornece 9, ♯11 e 13 sobre C7; ela não transforma automaticamente o baixo em Ré.',
  ],
  'h-modal-pedal': [
    'Pedal é uma nota sustentada ou repetida enquanto outras vozes mudam. Harmonia modal e ciclos de terças são recursos distintos que podem ampliar a sensação de percurso além das cadências habituais.',
    'O pedal funciona como um ponto fixo da paisagem enquanto você olha para direções diferentes. Os sons mudam ao redor sem apagar essa referência.',
    'Mantenha Dó no baixo e alterne C–F/C–G/C. Depois toque C–E–A♭ sem pedal: o ciclo por terças produz outra organização. Compare os dois recursos sem tratá-los como sinônimos.',
  ],
  'h-intervalos-base': [
    'Intervalo é a relação entre duas alturas, tocadas juntas ou em sequência. Reconhecer essas distâncias permite entender escalas e acordes antes de depender de formas de dedos.',
    'Uma melodia pode subir por um pequeno passo ou por um salto. Dar nome à distância permite repetir o mesmo gesto começando em outra nota.',
    'Cante Dó–Mi e depois Ré–Fá♯. As notas mudaram, mas ambos os pares formam uma terça maior. Compare com Dó–Mi♭, cuja distância é menor.',
  ],
  'h-notas-comuns': [
    'Notas comuns podem permanecer enquanto outras vozes se movem. Essa observação aproxima a análise de acordes da escuta de linhas individuais; proximidade não define sozinha uma função tonal.',
    'É como uma passagem de cena em que alguns personagens ficam e só um muda de lugar. O movimento pode ser suave mesmo quando o nome do acorde muda.',
    'C contém Dó–Mi–Sol; Am contém Lá–Dó–Mi. Mantenha Dó e Mi e mova Sol para Lá. Você ouvirá uma linha simples dentro de dois acordes.',
  ],
  'h-tonicizacao-modulacao': [
    'Tonicização destaca uma chegada local; modulação estabelece outro centro. Pedal descreve uma nota mantida, e não uma mudança de tonalidade. São três perguntas diferentes para a mesma análise.',
    'Visitar uma cidade é diferente de mudar de casa. E manter um ponto de referência durante o passeio é uma terceira coisa.',
    'Em C–A7–Dm–G7–C, observe a visita a Dm e o retorno. Para reconhecer uma mudança duradoura, escute a continuação e as chegadas seguintes, não apenas a presença de A7.',
  ],
};
