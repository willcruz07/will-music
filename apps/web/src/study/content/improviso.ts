import type { Lesson } from '../types.ts';

const t = (text: string) => ({ kind: 'text' as const, text });

export const IMPROVISO: Lesson[] = [
  {
    id: 'i-pentatonica',
    track: 'improviso',
    level: 'iniciante',
    title: 'Primeiro solo com a pentatônica',
    summary: 'Cinco notas para começar a criar frases com ritmo e intenção.',
    blocks: [
      t('A **pentatônica** tira da escala maior as duas notas que mais "brigam" com os acordes (o 4º e o 7º grau). Sobre uma música em Lá menor (ou Dó maior), a pentatônica de Lá menor é um ponto de partida; as notas sustentadas ainda precisam ser comparadas com cada acorde e com a melodia.'),
      { kind: 'scale', scale: 'minorPentatonic', root: 'A', caption: 'O desenho clássico da 5ª casa: decore esta posição primeiro.' },
      { kind: 'list', title: 'Dicas para soar musical desde o começo', items: ['**Toque pouco:** frases curtas com pausas soam melhor que notas sem parar.', '**Termine na tônica** ou numa nota do acorde que está tocando.', '**Repita a ideia:** uma frase repetida com um final diferente já é uma melodia.'] },
    ],
  },
  {
    id: 'i-notas-alvo',
    track: 'improviso',
    level: 'intermediario',
    title: 'Notas-alvo e arpejos',
    summary: 'Pousar nas notas do acorde para o solo "seguir a harmonia".',
    blocks: [
      t('As **notas-alvo** são as notas do acorde de cada momento, especialmente a **terça** e a **sétima**: são elas que dizem ao ouvido qual acorde está tocando. Um solo que cai nelas no tempo forte soa "dentro" da música.'),
      t('O **arpejo** é tocar as notas do acorde separadas. Pratique o arpejo de cada acorde da música antes de solar sobre ela.'),
      { kind: 'progression', name: 'Pratique os arpejos sobre o ii–V–I', degrees: ['ii7', 'V7', 'I7M'], key: 'C', caption: 'Dm7: Ré-Fá-Lá-Dó · G7: Sol-Si-Ré-Fá · C7M: Dó-Mi-Sol-Si. Ligue a sétima de um à terça do próximo.' },
      { kind: 'exercise', steps: ['Sobre cada acorde, toque só a terça no primeiro tempo do compasso.', 'Depois, faça frases livres que sempre terminem numa nota do acorde.'] },
    ],
  },
  {
    id: 'i-cromatismo',
    track: 'improviso',
    level: 'intermediario',
    title: 'Aproximações cromáticas e enclosures',
    summary: 'Notas de fora usadas para chegar mais forte nas de dentro.',
    blocks: [
      t('Uma nota de fora da escala vira charme quando **resolve** logo em seguida numa nota do acorde, por semitom. Três recursos:'),
      { kind: 'list', items: ['**Aproximação por baixo:** Si → Dó (chegando na tônica de C).', '**Aproximação por cima:** Ré♭ → Dó.', '**Enclosure (cerco):** Ré → Si → Dó, ou Ré♭ → Si → Dó: cerca o alvo por cima e por baixo.'] },
      { kind: 'tab', caption: 'Enclosure chegando no Dó (3ª corda, 5ª casa)', tab: ['e|--------------|', 'B|--------------|', 'G|--7-4-5-------|', 'D|--------------|', 'A|--------------|', 'E|--------------|'].join('\n') },
      { kind: 'tip', text: 'Coloque a nota de chegada (o alvo) **no tempo forte** e as notas cromáticas antes dela, nos tempos fracos.' },
    ],
  },
  {
    id: 'i-motivos',
    track: 'improviso',
    level: 'intermediario',
    title: 'Motivos, pergunta e resposta',
    summary: 'Como um solo conta uma história.',
    blocks: [
      t('Um solo memorável é feito de **motivos**: pequenas ideias de 3 a 5 notas que você repete, transpõe e varia. Funciona como uma conversa: uma frase **pergunta** (termina em suspenso) e a outra **responde** (termina em repouso).'),
      { kind: 'list', items: ['**Repetir** o motivo igual.', '**Transpor** para outra nota do acorde seguinte.', '**Mudar o ritmo** mantendo as notas.', '**Estender** com notas novas no final.'] },
      { kind: 'exercise', steps: ['Escolha 3 notas da pentatônica e faça 8 frases só com elas, variando o ritmo.', 'Cante uma frase e responda tocando no instrumento.'] },
    ],
  },
  {
    id: 'i-bebop',
    track: 'improviso',
    level: 'avancado',
    title: 'Escala bebop e linhas de jazz',
    summary: 'A nota de passagem que faz as notas do acorde caírem nos tempos.',
    blocks: [
      t('A **escala bebop dominante** acrescenta uma sétima maior de passagem ao mixolídio, totalizando oito notas. Em certos desenhos contínuos de colcheias, especialmente descendentes e iniciados no pulso por uma nota do acorde, isso ajuda a alinhar notas do acorde aos pulsos. O alinhamento depende do percurso e do ponto de partida; o balanço do jazz também envolve acentos, articulação e interpretação.'),
      { kind: 'scale', scale: 'bebopDominant', root: 'G', caption: 'Sobre G7: Sol, Lá, Si, Dó, Ré, Mi, Fá, Fá#.' },
      { kind: 'tip', text: 'Combine com enclosures e com o **ii–V**: comece a linha no Dm7 e "converse" com as guias até a terça do C.' },
    ],
  },
  {
    id: 'i-dominante-alterado',
    track: 'improviso',
    level: 'avancado',
    title: 'Tensão sobre o dominante',
    summary: 'Alterada, diminuta e tons inteiros sobre o V7.',
    blocks: [
      t('Em uma **cadência tonal**, o dominante pode concentrar tensão antes da chegada. As coleções abaixo oferecem cores diferentes sobre V7; escolha notas considerando a melodia, as alterações do acorde e o destino. Não é necessário tocar todas as cores juntas:'),
      { kind: 'scale', scale: 'altered', root: 'G', caption: 'Alterada: b9, #9, #11 e b13 juntas.' },
      { kind: 'scale', scale: 'diminishedHW', root: 'G', caption: 'Diminuta semitom-tom: b9, #9, #11 e 13.' },
      { kind: 'scale', scale: 'wholeTone', root: 'G', caption: 'Tons inteiros: 9, #11 e b13.' },
      { kind: 'tip', text: 'Neste estudo de cadência tonal, procure **resolver** a tensão: termine a frase numa nota do acorde de chegada (a terça do C, por exemplo).' },
    ],
  },
  {
    id: 'i-cores-exoticas',
    track: 'improviso',
    level: 'pro',
    title: 'Cores exóticas no solo',
    summary: 'Frígio dominante, menor húngara e escalas japonesas como tempero.',
    blocks: [
      t('Escalas de outras culturas trazem cores marcantes quando usadas com intenção, sobre um acorde que as aceite:'),
      { kind: 'list', items: ['**Frígio dominante** sobre o V7 de um tom menor (E7 em Lá menor): som árabe e flamenco.', '**Menor húngara** sobre o i menor com 7M: dramático, cigano.', '**Hirajoshi / In-sen** sobre acordes menores com 9 e 11: atmosfera oriental, suave.'] },
      { kind: 'scale', scale: 'phrygianDominant', root: 'E' },
      { kind: 'tip', text: 'Use a cor exótica em **um trecho** do solo e volte ao vocabulário do estilo: a surpresa vale pelo contraste.' },
    ],
  },
];
