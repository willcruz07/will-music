import type { Lesson } from '../types.ts';

const t = (text: string) => ({ kind: 'text' as const, text });
const CUIDADO = { kind: 'tip' as const, tone: 'warning' as const, text: 'Este conteúdo orienta o estudo, mas **não substitui um professor de canto ou um fonoaudiólogo**. Se sentir dor, rouquidão que não passa em dois dias ou perda de voz, pare e procure um profissional.' };

export const CANTO: Lesson[] = [
  {
    id: 'c-postura-respiracao',
    track: 'canto',
    level: 'iniciante',
    title: 'Postura, respiração e apoio',
    summary: 'O diafragma, a respiração baixa e o controle do ar.',
    blocks: [
      t('A voz é **ar em movimento** passando pelas pregas vocais. Por isso o canto começa na respiração. Em pé, com os pés na largura dos ombros, joelhos destravados, ombros soltos e o peito levemente aberto, o ar entra com mais facilidade.'),
      t('O **diafragma** é o músculo em forma de cúpula sob os pulmões. Na inspiração ele desce, e por isso a barriga e as costelas laterais se expandem: é a **respiração baixa** (costodiafragmática). O **apoio** é manter essa expansão enquanto o ar sai devagar, sem empurrar com a garganta.'),
      { kind: 'exercise', title: 'Exercícios', steps: ['Deite de barriga para cima com um livro sobre o umbigo: inspire pelo nariz fazendo o livro subir, sem subir os ombros.', 'Em pé, inspire em 4 tempos e solte o ar num "sss" contínuo por 8, depois 12 e 16 tempos, mantendo as costelas abertas.', 'Solte o ar em "s-s-s-s" curtos, sentindo a barriga trabalhar a cada som.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-afinacao',
    track: 'canto',
    level: 'iniciante',
    title: 'Afinação: ouvir antes de cantar',
    summary: 'Treinar o ouvido e usar uma referência.',
    blocks: [
      t('Afinar é **cantar a altura certa**. A afinação envolve percepção, memória auditiva e coordenação vocal; a dificuldade pode estar em mais de uma dessas etapas. O treino é ouvir uma nota, imaginá-la e então cantá-la.'),
      { kind: 'list', items: ['Cante junto de uma referência (teclado, violão ou o próprio app).', 'Use o **Microfone → Voz** do app para ver na tela se a nota está acima ou abaixo.', 'Grave-se e ouça: é o jeito mais rápido de perceber onde a afinação escapa.', 'Comece por notas confortáveis, no meio da sua extensão.'] },
      { kind: 'intervals', root: 'C', semitones: [2, 4, 5, 7], caption: 'Ouça, imagine e cante cada intervalo a partir do Dó' },
      CUIDADO,
    ],
  },
  {
    id: 'c-aquecimento',
    track: 'canto',
    level: 'iniciante',
    title: 'Aquecimento e desaquecimento',
    summary: 'Uma rotina de 10 minutos antes e depois de cantar.',
    blocks: [
      t('A voz é feita de músculos e precisa aquecer como qualquer outro. Uma boa rotina vai do mais leve ao mais exigente:'),
      { kind: 'exercise', title: 'Aquecimento (10 min)', steps: ['Alongue pescoço e ombros; massageie a mandíbula.', '**Vibração de lábios** ("brrr") subindo e descendo como uma sirene.', '**Bocca chiusa** (boca fechada, "mmm") em escalas de 5 notas.', '**Canudo:** sopre e cante num canudinho dentro de um copo com água (exercício de trato vocal semiocluído).', 'Vogais abertas ("ma-me-mi-mo-mu") em escalas, subindo meio tom por vez.'] },
      { kind: 'exercise', title: 'Desaquecimento (3 min)', steps: ['Glissandos descendentes suaves em "mmm".', 'Vibração de lábios em notas graves e confortáveis.', 'Bocejos e suspiros relaxados.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-articulacao',
    track: 'canto',
    level: 'intermediario',
    title: 'Articulação e dicção',
    summary: 'Palavras claras sem travar a voz.',
    blocks: [
      t('**Articular** é formar vogais e consoantes com clareza usando lábios, língua e mandíbula. No canto, as **vogais** carregam o som (sustente-as) e as **consoantes** são rápidas e precisas, quase no fim da sílaba.'),
      { kind: 'exercise', steps: ['Trava-línguas devagar e depois rápido: "O rato roeu a roupa do rei de Roma".', 'Cante uma frase só com as vogais, depois recoloque as consoantes mantendo o mesmo som.', 'Deixe a mandíbula cair solta nas vogais abertas (a, é, ó), sem empurrar o queixo para frente.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-ressonancia-projecao',
    track: 'canto',
    level: 'intermediario',
    title: 'Ressonância, colocação e projeção',
    summary: 'Volume sem força: o som que corre na sala.',
    blocks: [
      t('A **ressonância** é a amplificação do som nas cavidades acima das pregas (faringe, boca, nariz). A **colocação** é onde você sente essas vibrações: no peito nas notas graves, na "máscara" (ossos do rosto) nas médias e agudas.'),
      t('**Projetar** não é gritar. É usar bem a ressonância e o apoio para que o som chegue longe com pouco esforço na garganta.'),
      { kind: 'exercise', steps: ['Cante "nhã-nhã-nhã" sentindo vibrar o nariz e as bochechas.', 'Fale uma frase como se chamasse alguém do outro lado da rua, sem gritar; depois cante a mesma frase com essa sensação.', 'Sirene em "ng" (como no fim de "sing"): ótimo para encontrar a ressonância alta.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-liberacao',
    track: 'canto',
    level: 'intermediario',
    title: 'Liberação da voz: soltar as tensões',
    summary: 'Mandíbula, língua e pescoço livres.',
    blocks: [
      t('Tensão excessiva na mandíbula, na língua, na base do pescoço ou nos ombros "aperta" a voz, tira a extensão e cansa. **Liberar** a voz é cantar com o mínimo de esforço necessário.'),
      { kind: 'list', items: ['Língua relaxada com a ponta encostada atrás dos dentes de baixo.', 'Mandíbula solta, sem morder nem empurrar para a frente.', 'Pescoço alongado: não levante o queixo para alcançar as notas agudas.', 'Se a nota aguda exige esforço, volte ao exercício de canudo nela antes de cantar com texto.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-extensao-tessitura',
    track: 'canto',
    level: 'intermediario',
    title: 'Extensão, tessitura e classificação vocal',
    summary: 'Até onde a voz vai e onde ela mora.',
    blocks: [
      t('**Extensão** é do grave mais grave ao agudo mais agudo que você consegue emitir. **Tessitura** é a faixa onde você canta com conforto e qualidade por bastante tempo; é um dos fatores da classificação, junto do timbre, das passagens e da avaliação técnica: **baixo, barítono e tenor** (vozes masculinas) e **contralto, mezzo-soprano e soprano** (femininas).'),
      { kind: 'list', items: ['O **Microfone → Voz** do app mostra a extensão que você cantou e sugere a classificação.', 'A classificação também depende do timbre e de onde ficam as passagens: um professor confirma.', 'Escolha o **tom** das músicas pela sua tessitura, não pelo tom original.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-registros-passagem',
    track: 'canto',
    level: 'avancado',
    title: 'Registros, passagem e voz mista',
    summary: 'Do peito à cabeça sem "quebrar".',
    blocks: [
      t('A voz tem **registros**: a **voz de peito** (grave, cheia), a **voz de cabeça** (aguda, leve) e o **falsete**. A **passagem** é a região onde a voz muda de registro e às vezes "quebra". A **voz mista (mix)** equilibra os dois para atravessar a passagem com uma cor contínua.'),
      { kind: 'exercise', steps: ['Sirene em "u" do grave ao agudo, bem leve, deixando a voz mudar sem forçar.', 'Escalas em "nei-nei-nei" (vogal fechada e com ressonância nasal ajudam a misturar).', 'Diminua o volume ao chegar na passagem: o mix nasce leve e ganha corpo com o tempo.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-intervalos-canto',
    track: 'canto',
    level: 'avancado',
    title: 'Intervalos e percepção para cantores',
    summary: 'Cantar segunda voz e ler melodias.',
    blocks: [
      t('Cantar intervalos com segurança é o que permite fazer **segunda voz**, cantar em coral e ler partituras. A segunda voz mais comum no louvor e no sertanejo anda uma **terça** abaixo (ou acima) da melodia.'),
      { kind: 'intervals', root: 'C', semitones: [3, 4, 7, 8, 9], caption: 'Os intervalos mais usados em segunda voz' },
      { kind: 'exercise', steps: ['Cante a escala maior e, com a ajuda de alguém (ou do piano), faça a mesma escala uma terça acima.', 'Use a partitura **Coral (SATB)** do app para ouvir só o seu naipe e cantar junto.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-melismas',
    track: 'canto',
    level: 'avancado',
    title: 'Melismas, riffs e runs',
    summary: 'Várias notas numa sílaba, com precisão.',
    blocks: [
      t('**Melisma** é cantar várias notas numa mesma sílaba. Os **riffs e runs** do gospel e do R&B são melismas rápidos, quase sempre construídos sobre a **pentatônica** (maior ou menor) e a escala de **blues**.'),
      { kind: 'scale', scale: 'minorPentatonic', root: 'A', caption: 'A maioria dos runs cabe nesta escala.' },
      { kind: 'exercise', steps: ['Cante o run **devagar** com cada nota clara, em "a"; só depois acelere.', 'Divida o run em grupos de 3 ou 4 notas e acentue a primeira de cada grupo.', 'Use o metrônomo: precisão antes de velocidade.'] },
      CUIDADO,
    ],
  },
  {
    id: 'c-drivers',
    track: 'canto',
    level: 'pro',
    title: 'Drivers e distorção vocal com segurança',
    summary: 'Rouquidão controlada para rock, gospel e soul.',
    blocks: [
      t('Os **drivers** (ou distorções) são ruídos controlados adicionados à voz, produzidos por estruturas **acima das pregas vocais** (como as falsas pregas e as aritenoides), e não por "raspar" a garganta. A aparência de facilidade não garante execução segura; efeitos vocais exigem orientação individual, e esforço ou desconforto são motivos para interromper.'),
      { kind: 'list', items: ['Aprenda primeiro a cantar **limpo, com apoio e sem tensão** naquela região.', 'Não tente produzir distorção a partir de uma descrição escrita; procure acompanhamento técnico antes de praticar o efeito.', 'Use pouco: alguns segundos em pontos de clímax.', 'Hidrate-se e descanse a voz depois.', 'Pare imediatamente se houver dor, ardência ou rouquidão depois do estudo.'] },
      { kind: 'tip', tone: 'warning', text: 'Drivers devem ser aprendidos **com acompanhamento de um professor** de canto que domine a técnica. Este texto só explica o conceito.' },
    ],
  },
  {
    id: 'c-saude',
    track: 'canto',
    level: 'iniciante',
    title: 'Saúde vocal',
    summary: 'Hábitos que protegem a voz de quem canta toda semana.',
    blocks: [
      { kind: 'list', items: ['**Água:** beba ao longo do dia; a hidratação da voz vem de dentro.', '**Sono:** voz cansada é voz mais frágil.', '**Evite gritar e pigarrear**; prefira engolir ou tossir leve.', 'Cuidado com o refluxo, o álcool em excesso e o fumo.', 'Microfone e retorno bem ajustados evitam que você force para se ouvir.'] },
      CUIDADO,
    ],
  },
];
