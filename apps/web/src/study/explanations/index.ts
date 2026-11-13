import { HARMONY_EXPLANATIONS } from './harmonia.ts';
import { INSTRUMENT_EXPLANATIONS } from './instrumentos.ts';
import { RHYTHM_READING_EXPLANATIONS } from './ritmo-leitura.ts';
import { SCALE_IMPROV_EXPLANATIONS } from './escalas-improviso.ts';
import { STYLE_EXPLANATIONS } from './estilos.ts';
import { VOICE_EXPLANATIONS } from './voz.ts';
import type { Lesson, TrackId } from '../types.ts';
import type { Explanations } from './types.ts';

export const LESSON_EXPLANATIONS: Explanations = {
  ...HARMONY_EXPLANATIONS, ...RHYTHM_READING_EXPLANATIONS, ...SCALE_IMPROV_EXPLANATIONS,
  ...VOICE_EXPLANATIONS, ...INSTRUMENT_EXPLANATIONS, ...STYLE_EXPLANATIONS,
};

/** Keep original explanations first, then unpack them before the interactive examples. */
export const explainLesson = (lesson: Lesson): Lesson => {
  const explanation = LESSON_EXPLANATIONS[lesson.id];
  if (!explanation) return lesson;
  let afterIntroduction = 0;
  while (lesson.blocks[afterIntroduction]?.kind === 'text') afterIntroduction++;
  const [context, simple, example] = explanation;
  return { ...lesson, blocks: [
    ...lesson.blocks.slice(0, afterIntroduction),
    { kind: 'explanation', context, simple, example },
    ...lesson.blocks.slice(afterIntroduction),
  ] };
};

export const TRACK_INTRODUCTIONS: Record<TrackId, string> = {
  harmonia: 'Harmonia estuda como as notas se combinam e como os acordes se relacionam ao longo de uma música. A teoria dá nomes a escolhas que músicos fizeram e continuam fazendo; ela ajuda a ouvir e experimentar, em vez de limitar a criação. Pense nos acordes como lugares e nas progressões como percursos entre eles. Nesta trilha, você aprende primeiro a reconhecer os lugares para depois escolher caminhos.',
  ritmo: 'Ritmo organiza acontecimentos e silêncios no tempo. Marcar uma referência com o corpo, cantar e dançar são formas de vivenciar essa organização antes de escrevê-la. Pense no pulso como os passos de uma caminhada e nas notas como gestos que acontecem entre esses passos. Vamos separar velocidade, divisão e acento para você perceber o que realmente muda em cada exemplo.',
  partituras: 'A partitura é um sistema de escrita musical desenvolvido ao longo de séculos. Ela permite registrar alturas, durações e indicações de execução, mas a interpretação também depende da escuta e do estilo. Pense nela como um mapa: primeiro você aprende a legenda, depois acompanha pequenos trajetos e só então lê percursos maiores. Não é preciso reconhecer todos os símbolos de uma vez.',
  escalas: 'Uma escala organiza alturas e intervalos, mas cada tradição musical usa esse material de maneiras próprias. Pense numa coleção de palavras: a lista ajuda a começar, enquanto a maneira de formar frases dá identidade à linguagem. Nesta trilha, compare distâncias e notas de referência antes de decorar nomes; os sons temperados do app são uma aproximação de algumas tradições, não sua reprodução completa.',
  improviso: 'Improvisar é tomar decisões musicais durante a execução usando escuta, memória e vocabulário. A prática existe em muitas tradições e não significa criar sem nenhuma referência. É como conversar: você escolhe o que dizer enquanto fala, apoiado no que aprendeu e no que acabou de ouvir. Começaremos com poucas notas, repetição e silêncio antes de ampliar as possibilidades.',
  canto: 'Cantar combina percepção, respiração, produção vocal e intenção do texto. A voz é individual; as imagens usadas no ensino ajudam a perceber uma coordenação, mas não descrevem sempre literalmente a anatomia. Pense nesta trilha como um guia para entender o que observar e o que conversar com seu professor, sem transformar extensão, volume ou velocidade em provas de capacidade.',
  violao: 'Violão e guitarra compartilham, na afinação usual, a organização de notas estudada aqui, mas podem cumprir papéis e produzir timbres diferentes. O braço é um mapa de alturas: as formas de dedos são caminhos úteis, não o objetivo final. Primeiro vamos tocar com clareza e manter o ritmo; depois ligar posições, compreender as notas e escolher espaço dentro de um arranjo.',
  teclado: 'No teclado, a repetição das teclas ajuda a visualizar intervalos, e as duas mãos permitem combinar linhas ao mesmo tempo. Imagine uma pequena banda: baixo, acompanhamento e melodia podem se dividir entre as mãos ou ser compartilhados com outros músicos. Vamos aprender a organizar essas tarefas e a escolher posições claras, sem confundir uma cifra com uma única forma de tocá-la.',
  cavaquinho: 'O cavaquinho tem quatro cordas e participa de diferentes tradições e formações. Nesta trilha usamos uma afinação brasileira comum e estudamos acompanhamento, melodia e arranjo. Pense nas quatro cordas como um espaço de escrita compacto: escolher bem as notas e os ataques importa mais do que tentar incluir tudo. Afinação, ritmo e clareza vêm antes de passagens complexas.',
  bateria: 'A bateria reúne peças que podem exercer funções complementares sob o controle de uma pessoa. Sua formação moderna está ligada à reunião de instrumentos de percussão em um conjunto tocado com mãos e pés. Pense numa equipe: algumas peças marcam apoios, outras dividem o tempo e outras respondem à frase. A coordenação cresce por camadas, sem exigir que todos os membros façam algo difícil desde o início.',
  estilos: 'Um estilo reúne práticas de ritmo, melodia, harmonia, timbre e convivência musical construídas em comunidades e contextos históricos. É como um modo de falar: conhecer palavras ajuda, mas pronúncia, ritmo e intenção também contam. Os exemplos desta trilha são portas de entrada para a escuta; não fórmulas que tornam qualquer sequência de acordes automaticamente samba, jazz ou gospel.',
};
