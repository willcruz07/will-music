import type { ScaleKind } from '../lib/chordTheory.ts';

/** Editorial guidance complements the scale formula, without prescribing a single harmonic use. */
export const SCALE_CONTEXT: Record<ScaleKind, { character: string; use: string; practice: string }> = {
  major: {
    character: 'O modo jônio é a referência da harmonia maior. A terça maior define essa qualidade; a sétima maior fica a meio tom da tônica e pode criar uma sensação de chegada.',
    use: 'É frequente no pop, no louvor e na música tonal. Ajuda a entender os acordes do campo maior e as relações de repouso, afastamento e tensão.',
    practice: 'Cante a escala e termine pequenas frases na tônica. Depois ouça I–IV–V–I e perceba como o centro tonal se mantém.',
  },
  minor: {
    character: 'O modo eólio, ou menor natural, tem terça, sexta e sétima menores em relação ao maior paralelo. Essas notas dão uma cor diferente, que não precisa ser necessariamente triste.',
    use: 'Aparece em baladas, rock, pop e música modal. Seu quinto grau é menor; o V maior encontrado em muitas músicas menores usa a sétima elevada, ausente nesta escala.',
    practice: 'Compare maior e menor com a mesma tônica, ouvindo as mudanças na terça, sexta e sétima. Resolva frases na tônica para não perder o centro menor.',
  },
  harmonicMinor: {
    character: 'Parte da menor natural e eleva a sétima. A distância de três semitons entre o sexto e o sétimo graus produz uma segunda aumentada, uma de suas marcas sonoras.',
    use: 'Explica o V7 e o acorde diminuto do sétimo grau em tonalidades menores. Costuma alternar com outras formas da escala menor, conforme a melodia e a harmonia.',
    practice: 'Compare o quinto grau da menor natural com o da menor harmônica. Ouça i–iv–V7–i e perceba a sétima elevada conduzindo à tônica.',
  },
  dorian: {
    character: 'É um modo menor com sexta maior. Em comparação com o eólio, essa única alteração dá outra cor ao acorde menor e permite um IV maior.',
    use: 'É frequente em jazz modal, funk e improvisação sobre acordes menores quando a sexta maior combina com o acompanhamento. Não é intercambiável com qualquer escala menor.',
    practice: 'Toque i–IV–i mantendo a tônica como referência. Compare a sexta maior do dórico com a sexta menor do eólio.',
  },
  phrygian: {
    character: 'A segunda menor, a meio tom da tônica, é sua marca principal. Também tem terça, sexta e sétima menores, formando uma sonoridade de tensão próxima do centro.',
    use: 'Aparece em contextos modais, metal e passagens de influência espanhola. Não deve ser confundido com o frígio dominante, que possui terça maior.',
    practice: 'Ouça i–bII–i e explore o movimento da segunda menor para a tônica. Preserve o centro para não ouvir apenas a escala maior relativa.',
  },
  lydian: {
    character: 'É um modo maior com quarta aumentada. A #4, ou #11 quando tratada como extensão, diferencia sua sonoridade do jônio e mantém a terça maior.',
    use: 'É utilizado em jazz, trilhas e harmonias maiores com #11. Sua cor depende da compatibilidade dessa nota com os acordes e com a melodia.',
    practice: 'Compare a quarta justa do maior com a quarta aumentada do lídio. Experimente I–II–I, sustentando a tônica como centro.',
  },
  mixolydian: {
    character: 'É um modo maior com sétima menor. Essa alteração permite o bVII maior e forma uma tétrade de tipo 7 sobre a própria tônica.',
    use: 'Aparece em rock, folk, funk e ambientes modais. Um acorde 7 pode ser centro mixolídio; sua qualidade, sozinha, não obriga a uma resolução dominante.',
    practice: 'Ouça I–bVII–IV–I. Compare a sétima menor com a sétima maior do jônio e termine as frases na tônica do modo.',
  },
  locrian: {
    character: 'Tem segunda menor e quinta diminuta. A tríade inicial é diminuta e a tétrade é meio-diminuta, o que torna seu centro menos estável que o dos outros modos diatônicos.',
    use: 'É uma possibilidade sobre acordes meio-diminutos quando suas notas combinam com o contexto. Em jazz, outras opções, como o lócrio com segunda maior, também são usadas.',
    practice: 'Ouça o primeiro grau com atenção à quinta diminuta. Use uma nota pedal na tônica e frases curtas; não espere a mesma estabilidade de uma cadência maior.',
  },
  majorPentatonic: {
    character: 'Reúne os graus 1, 2, 3, 5 e 6 da escala maior. A ausência de quarta e sétima elimina os semitons internos, favorecendo frases abertas e cantáveis.',
    use: 'É comum em country, pop, gospel e solos em contexto maior. Ainda é necessário ouvir as notas do acorde: ter cinco notas não garante que todas sejam repouso em qualquer momento.',
    practice: 'Crie frases de poucas notas e procure terminar em notas do acorde. O campo maior mostrado abaixo é uma referência, não uma harmonização exclusiva das cinco notas.',
  },
  minorPentatonic: {
    character: 'Reúne os graus 1, b3, 4, 5 e b7. Não possui segunda nem sexta, e seu desenho facilita motivos curtos e repetidos.',
    use: 'É comum em rock, blues, funk e improvisação menor. No blues também pode aparecer sobre acordes maiores, criando uma tensão expressiva entre a terça menor da escala e a terça maior do acorde.',
    practice: 'Repita um motivo e varie o ritmo antes de acrescentar notas. O campo menor natural abaixo serve de referência e inclui notas ausentes nesta pentatônica.',
  },
  blues: {
    character: 'Acrescenta a quinta diminuta à pentatônica menor. Essa blue note fica entre a quarta e a quinta justa e funciona frequentemente como passagem ou tensão expressiva.',
    use: 'É comum no blues, no rock e em frases de jazz. A expressividade depende também do ritmo, da articulação e de inflexões de altura que a escala escrita não representa por completo.',
    practice: 'Compare a pentatônica menor com a blues. Explore 4–b5–5 em frases curtas e ouça a resolução; o campo menor de referência não explica sozinho toda a harmonia do blues.',
  },
};
