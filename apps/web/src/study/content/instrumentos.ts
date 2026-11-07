import type { Lesson } from '../types.ts';

const t = (text: string) => ({ kind: 'text' as const, text });
const tab = (...lines: string[]) => lines.join('\n');

export const VIOLAO: Lesson[] = [
  {
    id: 'v-acordes-abertos',
    track: 'violao',
    level: 'iniciante',
    title: 'Acordes abertos e trocas',
    summary: 'Os primeiros acordes e como trocar sem parar o ritmo.',
    blocks: [
      t('Os acordes **abertos** usam cordas soltas e ficam nas primeiras casas. Com estes você já toca centenas de músicas:'),
      { kind: 'chords', chords: ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm'], caption: 'Toque num acorde para ver a digitação' },
      { kind: 'exercise', steps: ['Troque entre dois acordes (G e C) a cada 4 tempos com metrônomo a 60 BPM.', 'Mantenha os dedos que se repetem entre os acordes (o "dedo-guia").', 'Só aumente a velocidade quando a troca sair limpa 10 vezes seguidas.'] },
    ],
  },
  {
    id: 'v-batidas',
    track: 'violao',
    level: 'iniciante',
    title: 'Batidas de mão direita',
    summary: 'Pop, balada, sertanejo e o "toque" de louvor.',
    blocks: [
      t('A mão direita é o baterista do violão. Mantenha o braço em movimento constante de **descida e subida** (em semicolcheias) e só encoste nas cordas onde a batida pede. Assim o tempo nunca se perde.'),
      { kind: 'rhythm', caption: 'Batida pop: B B C C B C (B = baixo, C = cima)', sticking: '↓ . ↓ ↑ . ↑ ↓ ↑', pattern: { bpm: 90, steps: 8, perBeat: 2, tracks: [{ sound: 'snare', pattern: 'x.xx.xxx', label: 'Cordas' }] } },
      { kind: 'rhythm', caption: 'Balada em 4/4 com abafado no 2 e no 4', pattern: { bpm: 72, steps: 16, tracks: [{ sound: 'kick', pattern: 'x.......x.......', label: 'Baixo' }, { sound: 'snare', pattern: '....x.......x...', label: 'Abafado' }, { sound: 'hihat', pattern: '..x...x...x...x.', label: 'Cordas' }] } },
    ],
  },
  {
    id: 'v-pestana-caged',
    track: 'violao',
    level: 'intermediario',
    title: 'Pestana e o sistema CAGED',
    summary: 'Cinco formas para tocar qualquer acorde em todo o braço.',
    blocks: [
      t('O **CAGED** parte de que os acordes abertos C, A, G, E e D podem ser "carregados" pelo braço com a pestana fazendo o papel da pestana do violão. Cada forma tem a tônica numa corda diferente, e as cinco se encaixam como peças, cobrindo todo o braço.'),
      { kind: 'chords', chords: ['F', 'Bb', 'Bm', 'F#m', 'C#m'], caption: 'Acordes com pestana (forma de E e de A)' },
      { kind: 'tip', text: 'Na pestana, use a **lateral do indicador** (mais ossuda) e puxe o braço levemente para trás em vez de apertar com o polegar.' },
    ],
  },
  {
    id: 'v-pentatonica-braco',
    track: 'violao',
    level: 'intermediario',
    title: 'A pentatônica em todo o braço',
    summary: 'As cinco posições e como ligá-las.',
    blocks: [
      t('A pentatônica tem **cinco desenhos** que se repetem pelo braço. Comece pela posição 1 (tônica na 6ª corda) e aprenda as vizinhas uma por vez, sempre localizando a **tônica** em cada desenho.'),
      { kind: 'scale', scale: 'minorPentatonic', root: 'A' },
      { kind: 'scale', scale: 'majorPentatonic', root: 'C', caption: 'Mesmas notas da Lá menor: o que muda é a tônica (Dó).' },
    ],
  },
  {
    id: 'v-tecnicas',
    track: 'violao',
    level: 'intermediario',
    title: 'Técnicas de expressão',
    summary: 'Bend, vibrato, slide, hammer-on e pull-off.',
    blocks: [
      { kind: 'list', items: ['**Hammer-on (h):** toque uma nota e "martele" outro dedo numa casa acima sem palhetar.', '**Pull-off (p):** o contrário, puxando o dedo para soar a nota de baixo.', '**Slide (/ ou \\):** deslize o dedo de uma casa a outra mantendo a pressão.', '**Bend (b):** empurre a corda para subir a afinação (meio tom ou um tom). Confira com a nota real da casa de destino.', '**Vibrato (~):** oscile a altura no fim da nota; é a "assinatura" de cada guitarrista.'] },
      { kind: 'tab', caption: 'Frase com hammer-on, pull-off e slide (Lá menor)', tab: tab('e|---------------|', 'B|---------------|', 'G|-5-7-5---------|', 'D|-------7-5-----|', 'A|-----------7-5-|', 'E|---------------|') },
    ],
  },
  {
    id: 'v-licks',
    track: 'violao',
    level: 'avancado',
    title: 'Licks essenciais',
    summary: 'Frases de blues, rock e worship para o seu vocabulário.',
    blocks: [
      t('**Licks** são frases prontas que você aprende, varia e mistura. Aprenda cada uma em três andamentos, depois mude o final e transponha para outros tons.'),
      { kind: 'tab', caption: 'Lick de blues em Lá (posição 5)', bpm: 80, tab: tab('e|-----------5-8-5-------|', 'B|-------5-8-------8-5---|', 'G|-5-7-----------------7-|', 'D|-----------------------|', 'A|-----------------------|', 'E|-----------------------|') },
      { kind: 'tab', caption: 'Lick de rock em Mi (pentatônica, casa 12)', bpm: 100, tab: tab('e|-12-15-12------------|', 'B|----------15-12------|', 'G|----------------14-12|', 'D|---------------------|', 'A|---------------------|', 'E|---------------------|') },
      { kind: 'tab', caption: 'Lick de worship em Ré (pentatônica maior, notas longas)', bpm: 70, tab: tab('e|---------------------|', 'B|-------7-10-7--------|', 'G|-7-9-----------9-7---|', 'D|-------------------9-|', 'A|---------------------|', 'E|---------------------|') },
      { kind: 'tip', text: 'No worship, menos é mais: notas longas, com **delay e reverb**, deixando espaço para a voz.' },
    ],
  },
  {
    id: 'v-arpejos-triades',
    track: 'violao',
    level: 'pro',
    title: 'Tríades no braço e arpejos',
    summary: 'Tocar acordes em cordas agudas para arranjos e base de guitarra.',
    blocks: [
      t('As **tríades em grupos de 3 cordas** (1-2-3, 2-3-4…) são a ferramenta do guitarrista de banda: ocupam pouco espaço sonoro, não brigam com o teclado e soam claras. Aprenda as três inversões de cada tríade em cada grupo de cordas.'),
      { kind: 'tab', caption: 'Tríade de Sol maior nas cordas 1-2-3 (três inversões)', tab: tab('e|-3---7---10-|', 'B|-3---8---12-|', 'G|-4---7---12-|', 'D|------------|', 'A|------------|', 'E|------------|') },
    ],
  },
];

export const TECLADO: Lesson[] = [
  {
    id: 't-maos',
    track: 'teclado',
    level: 'iniciante',
    title: 'Mão esquerda e mão direita',
    summary: 'Baixo na esquerda, acorde na direita.',
    blocks: [
      t('O ponto de partida no teclado é dividir as funções: a **mão esquerda** toca a **tônica** (ou tônica e oitava) no grave e a **mão direita** toca a **tríade** no meio do teclado. Isso já soa como um arranjo cheio.'),
      { kind: 'progression', name: 'Pratique com I – V – vi – IV', degrees: ['I', 'V', 'vi', 'IV'], key: 'C' },
      { kind: 'tip', text: 'Não toque a terça no grave da mão esquerda: no grave, notas próximas embolam o som.' },
    ],
  },
  {
    id: 't-inversoes',
    track: 'teclado',
    level: 'iniciante',
    title: 'Inversões para trocar suave',
    summary: 'Mover a mão direita o mínimo possível.',
    blocks: [
      t('Em vez de saltar com a mão direita de um acorde para outro na mesma forma, use **inversões** para que as notas comuns fiquem paradas e as outras andem um ou dois semitons. O som fica mais "profissional" e a mão cansa menos.'),
      { kind: 'chords', chords: ['C', 'G/B', 'Am', 'F/A'], caption: 'Veja no diagrama de teclado e toque nas inversões' },
    ],
  },
  {
    id: 't-voicings',
    track: 'teclado',
    level: 'intermediario',
    title: 'Voicings de tétrades: shell e rootless',
    summary: 'Como pianistas de jazz e MPB distribuem as notas.',
    blocks: [
      { kind: 'list', items: ['**Shell (mão esquerda):** tônica + sétima ou tônica + terça; a direita toca as tensões ou a melodia.', '**Rootless tipo A:** 3 – 5 – 7 – 9 (ex.: Dm7(9) = Fá, Lá, Dó, Mi).', '**Rootless tipo B:** 7 – 9 – 3 – 5 (ex.: Dó, Mi, Fá, Lá).', 'No ii–V–I, alternar A e B faz as vozes andarem quase sem saltos.'] },
      { kind: 'progression', name: 'ii–V–I com tensões', degrees: ['ii7(9)', 'V7(13)', 'I7M(9)'], key: 'C' },
    ],
  },
  {
    id: 't-gospel-chords',
    track: 'teclado',
    level: 'avancado',
    title: 'Gospel chords',
    summary: 'Os acordes de passagem e as cores do piano gospel.',
    blocks: [
      t('O piano gospel americano é cheio de **acordes de passagem**: entre dois acordes da música, o tecladista insere um dominante, um diminuto ou uma aproximação cromática. Recursos típicos:'),
      { kind: 'list', items: ['**2-5 para tudo:** cada acorde ganha o seu ii–V.', '**Diminuto de passagem** entre I e ii (C → C#°7 → Dm7).', '**IV para iv** e **bVII** no final (empréstimo modal).', '**Acorde 6/9 e 7M(9)** no I; **7(#9)** e **7(b13)** nos dominantes.', '**"Church" ending:** IV – iv – I com a linha do baixo descendo.'] },
      { kind: 'progression', name: 'Passagem gospel no I – IV', degrees: ['I6(9)', 'V7/IV', 'IV7M', 'iv6', 'I6(9)'], key: 'Ab' },
      { kind: 'progression', name: 'Cadeia de 2-5 até o vi', degrees: ['I7M', 'iiø/vi', 'V7(b9)/vi', 'vi7', 'ii7', 'V7(13)', 'I7M'], key: 'Eb' },
    ],
  },
  {
    id: 't-reharm-louvor',
    track: 'teclado',
    level: 'pro',
    title: 'Rearmonizando um louvor no teclado',
    summary: 'Da cifra simples ao arranjo de igreja moderna.',
    blocks: [
      t('Pegue um louvor de quatro acordes e aplique, uma por vez: **(1)** troque as tríades por 7M(9), m7(9) e 7(13); **(2)** use o baixo caminhando com inversões; **(3)** insira um ii–V antes do IV; **(4)** termine com IV – iv – I.'),
      { kind: 'progression', name: 'Original', degrees: ['I', 'V', 'vi', 'IV'], key: 'G' },
      { kind: 'progression', name: 'Rearmonizado', degrees: ['I7M(9)', 'V7(13)/vi', 'vi7(9)', 'V7/IV', 'IV7M', 'iv6', 'I7M(9)'], key: 'G' },
    ],
  },
];

export const BATERIA: Lesson[] = [
  {
    id: 'b-rudimentos',
    track: 'bateria',
    level: 'iniciante',
    title: 'Rudimentos: toque simples, duplo e paradiddle',
    summary: 'A base técnica de todo baterista.',
    blocks: [
      t('Os **rudimentos** são padrões de manulação (D = direita, E = esquerda) que formam toda a linguagem da bateria. A Percussive Arts Society lista 40 rudimentos internacionais; estes três são o começo de tudo:'),
      { kind: 'rhythm', caption: 'Toque simples (single stroke)', sticking: 'D E D E D E D E', pattern: { bpm: 80, steps: 8, tracks: [{ sound: 'snare', pattern: 'xxxxxxxx' }] } },
      { kind: 'rhythm', caption: 'Toque duplo (double stroke)', sticking: 'D D E E D D E E', pattern: { bpm: 80, steps: 8, tracks: [{ sound: 'snare', pattern: 'xxxxxxxx' }] } },
      { kind: 'rhythm', caption: 'Paradiddle simples', sticking: 'D E D D E D E E', pattern: { bpm: 80, steps: 8, tracks: [{ sound: 'snare', pattern: 'x..x....', label: 'Acento' }, { sound: 'hihat', pattern: 'xxxxxxxx', label: 'Toques' }] } },
      { kind: 'tip', text: 'Estude com metrônomo, devagar e com os **acentos bem definidos** (o primeiro toque de cada grupo do paradiddle).' },
    ],
  },
  {
    id: 'b-grooves-basicos',
    track: 'bateria',
    level: 'iniciante',
    title: 'Grooves básicos: rock, balada e 6/8',
    summary: 'Os três ritmos que mais aparecem no culto e na banda.',
    blocks: [
      { kind: 'rhythm', caption: 'Rock em colcheias', pattern: { bpm: 100, steps: 16, tracks: [{ sound: 'hihat', pattern: 'x.x.x.x.x.x.x.x.' }, { sound: 'snare', pattern: '....x.......x...' }, { sound: 'kick', pattern: 'x.......x.x.....' }] } },
      { kind: 'rhythm', caption: 'Balada (chimbal em semínimas no 2 e 4 da caixa)', pattern: { bpm: 68, steps: 16, tracks: [{ sound: 'hihat', pattern: 'x...x...x...x...' }, { sound: 'snare', pattern: '....x.......x...' }, { sound: 'kick', pattern: 'x.....x.x.......' }] } },
      { kind: 'rhythm', caption: '6/8', pattern: { bpm: 60, steps: 6, perBeat: 3, tracks: [{ sound: 'hihat', pattern: 'xxxxxx' }, { sound: 'snare', pattern: '...x..' }, { sound: 'kick', pattern: 'x.....' }] } },
    ],
  },
  {
    id: 'b-viradas',
    track: 'bateria',
    level: 'intermediario',
    title: 'Viradas e dinâmica',
    summary: 'Como sair de uma parte e entrar na outra.',
    blocks: [
      t('A **virada** (fill) anuncia uma mudança de parte. A regra de ouro: **termine no "1"** do próximo compasso com prato e bumbo, e não acelere. Viradas curtas (meio tempo ou um tempo) soam mais musicais do que viradas longas a cada quatro compassos.'),
      { kind: 'rhythm', caption: 'Groove de 3 tempos + virada de 1 tempo', pattern: { bpm: 90, steps: 16, tracks: [{ sound: 'hihat', pattern: 'x.x.x.x.x.x.....' }, { sound: 'snare', pattern: '....x.......xxxx' }, { sound: 'kick', pattern: 'x.......x.......' }] } },
    ],
  },
  {
    id: 'b-ghost-independencia',
    track: 'bateria',
    level: 'intermediario',
    title: 'Ghost notes e independência',
    summary: 'Caixa fantasma e bumbo livre sob o chimbal.',
    blocks: [
      t('**Independência** é cada membro fazer uma coisa diferente sem que um atrapalhe o outro. Comece com o chimbal fixo em colcheias e varie só o bumbo; depois acrescente notas fantasma bem leves na caixa entre os acentos do 2 e do 4.'),
      { kind: 'rhythm', caption: 'Funk com ghost notes', pattern: { bpm: 94, steps: 16, tracks: [{ sound: 'hihat', pattern: 'x.x.x.x.x.x.x.x.' }, { sound: 'snare', pattern: '..x.x.xx.x..x.x.', label: 'Caixa (2 e 4 + fantasmas)' }, { sound: 'kick', pattern: 'x..x......x..x..' }] } },
    ],
  },
  {
    id: 'b-samba-pagode',
    track: 'bateria',
    level: 'avancado',
    title: 'Samba e pagode na bateria',
    summary: 'Surdo no 2, caixa em semicolcheias e o balanço do partido.',
    blocks: [
      t('No samba, a **marcação** do surdo cai no **segundo tempo** do 2/4 (o tempo forte do samba é o 2). A caixa (ou o aro) toca semicolcheias com acentos, e o bumbo imita o surdo com uma nota curta antes do tempo.'),
      { kind: 'rhythm', caption: 'Samba (2/4 escrito em dois tempos)', pattern: { bpm: 100, steps: 8, tracks: [{ sound: 'hihat', pattern: 'xxxxxxxx', label: 'Aro / chimbal' }, { sound: 'snare', pattern: 'x..x..x.', label: 'Acentos' }, { sound: 'kick', pattern: '...x...x', label: 'Bumbo (surdo)' }] } },
    ],
  },
  {
    id: 'b-gospel-chops',
    track: 'bateria',
    level: 'pro',
    title: 'Gospel chops',
    summary: 'A linguagem dos bateristas de igreja americana.',
    blocks: [
      t('"Chops" é a técnica e o vocabulário rápido e preciso dos bateristas gospel (shed). Os elementos principais:'),
      { kind: 'list', items: ['**Frases lineares:** um membro por vez (mão, mão, bumbo…), sem dois tocando juntos, em sextinas e quintinas.', '**Singles com bumbo:** "D E B" (direita, esquerda, bumbo) repetido em tercinas.', '**Rudimentos deslocados** pelos tambores e pratos.', '**Dinâmica extrema:** do quase silêncio ao clímax, acompanhando o pregador ou o cantor.', '**Musicalidade primeiro:** os chops entram nos espaços, nunca por cima da voz.'] },
      { kind: 'rhythm', caption: 'Frase linear D-E-B em tercinas', sticking: 'D E B D E B D E B D E B', pattern: { bpm: 80, steps: 12, perBeat: 3, tracks: [{ sound: 'snare', pattern: 'xx.xx.xx.xx.', label: 'Mãos' }, { sound: 'kick', pattern: '..x..x..x..x' }] } },
      { kind: 'tip', text: 'Grave você tocando e confira: se a frase rápida faz o tempo oscilar, toque-a mais devagar até ela soar limpa.' },
    ],
  },
];
