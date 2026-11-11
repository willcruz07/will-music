import type { Lesson } from '../types.ts';

const t = (text: string) => ({ kind: 'text' as const, text });

export const RITMO: Lesson[] = [
  {
    id: 'r-pulso',
    track: 'ritmo',
    level: 'iniciante',
    title: 'Pulso, compasso e andamento',
    summary: 'Sentir o tempo antes de qualquer nota.',
    blocks: [
      t('O **pulso** é a batida constante que você marca com o pé. O **andamento** é a velocidade desse pulso, em BPM (batidas por minuto). O **compasso** agrupa os pulsos: 4/4 (quatro tempos, o mais comum), 3/4 (valsa), 6/8 (balada em dois tempos de três).'),
      { kind: 'rhythm', caption: '4/4: o primeiro tempo é o mais forte', pattern: { bpm: 90, steps: 16, tracks: [{ sound: 'kick', pattern: 'x...............' }, { sound: 'hihat', pattern: 'x...x...x...x...' }] } },
      { kind: 'rhythm', caption: '3/4: valsa (um, dois, três)', pattern: { bpm: 110, steps: 12, tracks: [{ sound: 'kick', pattern: 'x...........' }, { sound: 'hihat', pattern: 'x...x...x...' }] } },
      { kind: 'exercise', steps: ['Use um metrônomo a 70 BPM e bata palmas junto por 1 minuto sem olhar.', 'Conte em voz alta "1, 2, 3, 4" enquanto toca uma música que você conhece.'] },
    ],
  },
  {
    id: 'r-subdivisao',
    track: 'ritmo',
    level: 'iniciante',
    title: 'Subdivisão: colcheias e semicolcheias',
    summary: 'Dividir o tempo em 2 e em 4 para tocar firme.',
    blocks: [
      t('Cada tempo pode ser dividido em **duas colcheias** ("1 e 2 e") ou **quatro semicolcheias** ("1 e e a"…; em português, "1-e-e-a"). Quem pensa na subdivisão toca mais preciso, mesmo nas notas longas.'),
      { kind: 'rhythm', caption: 'Colcheias no chimbal', pattern: { bpm: 80, steps: 16, tracks: [{ sound: 'hihat', pattern: 'x.x.x.x.x.x.x.x.' }, { sound: 'kick', pattern: 'x.......x.......' }, { sound: 'snare', pattern: '....x.......x...' }] } },
      { kind: 'rhythm', caption: 'Semicolcheias no chimbal', pattern: { bpm: 70, steps: 16, tracks: [{ sound: 'hihat', pattern: 'xxxxxxxxxxxxxxxx' }, { sound: 'kick', pattern: 'x.......x.......' }, { sound: 'snare', pattern: '....x.......x...' }] } },
    ],
  },
  {
    id: 'r-sincope',
    track: 'ritmo',
    level: 'intermediario',
    title: 'Síncope e contratempo',
    summary: 'Tocar entre os tempos: o segredo do balanço brasileiro e do pop.',
    blocks: [
      t('O **contratempo** é tocar no "e" (a metade do tempo), deixando o tempo forte vazio. A **síncope** é uma nota que começa num tempo fraco e se prolonga sobre o forte, deslocando a acentuação. Ela está em quase todo o samba, o funk e o pop.'),
      { kind: 'rhythm', caption: 'Contratempo (reggae, ska)', pattern: { bpm: 90, steps: 16, tracks: [{ sound: 'hihat', pattern: '..x...x...x...x.' }, { sound: 'kick', pattern: 'x.......x.......' }] } },
      { kind: 'rhythm', caption: 'Síncope típica (3+3+2)', pattern: { bpm: 95, steps: 16, tracks: [{ sound: 'snare', pattern: 'x..x..x.x..x..x.' }, { sound: 'hihat', pattern: 'x.x.x.x.x.x.x.x.' }] } },
      { kind: 'tip', text: 'O padrão **3+3+2** (tresillo) é a raiz rítmica de muita música latina, do baião e do pop atual.' },
    ],
  },
  {
    id: 'r-tercinas',
    track: 'ritmo',
    level: 'intermediario',
    title: 'Tercinas, 6/8 e swing',
    summary: 'Dividir o tempo em três: shuffle, gospel e baladas.',
    blocks: [
      t('Na **tercina** o tempo é dividido em três partes iguais. Como aproximação inicial de **shuffle**, toque a primeira e a terceira subdivisões de uma tercina; o **swing** tem proporção flexível conforme andamento, frase e estilo, não uma divisão fixa universal ("dum-da dum-da"). O 6/8 e o 12/8 das baladas gospel vivem dessa divisão.'),
      { kind: 'rhythm', caption: 'Shuffle (tercinas com o meio vazio)', pattern: { bpm: 85, steps: 12, perBeat: 3, tracks: [{ sound: 'hihat', pattern: 'x.xx.xx.xx.x' }, { sound: 'kick', pattern: 'x.....x.....' }, { sound: 'snare', pattern: '...x.....x..' }] } },
      { kind: 'rhythm', caption: '12/8 de balada gospel', pattern: { bpm: 60, steps: 12, perBeat: 3, tracks: [{ sound: 'hihat', pattern: 'xxxxxxxxxxxx' }, { sound: 'kick', pattern: 'x.....x.....' }, { sound: 'snare', pattern: '...x.....x..' }] } },
    ],
  },
  {
    id: 'r-groove',
    track: 'ritmo',
    level: 'avancado',
    title: 'Groove: pocket, dinâmica e notas fantasma',
    summary: 'O que faz uma banda soar "colada".',
    blocks: [
      t('**Groove** não é tocar mais notas, é tocar no lugar certo. **Pocket** é a margem de tempo em que a banda toca junta: mais "em cima" (pra frente, ansioso), no centro ou "atrás" (relaxado, como no neo-soul e no R&B).'),
      { kind: 'list', items: ['**Dinâmica:** acentue os tempos que importam e toque baixo o resto.', '**Notas fantasma (ghost notes):** toques bem leves na caixa entre os acentos; dão textura sem poluir.', '**Espaço:** a pausa também é ritmo. Um baixo que deixa respirar faz o groove andar.'] },
      { kind: 'rhythm', caption: 'Groove com ghost notes na caixa', pattern: { bpm: 92, steps: 16, tracks: [{ sound: 'hihat', pattern: 'x.x.x.x.x.x.x.x.' }, { sound: 'snare', pattern: '..o.X..o.o..X..o', label: 'Caixa (acentos e fantasmas)' }, { sound: 'kick', pattern: 'x.....x...x.....' }] } },
    ],
  },
  {
    id: 'r-polirritmia',
    track: 'ritmo',
    level: 'pro',
    title: 'Polirritmia e deslocamento',
    summary: '3 contra 2, 3 contra 4 e frases que atravessam a barra.',
    blocks: [
      t('Na **polirritmia** duas divisões diferentes soam juntas: **3 contra 2** (tercina contra colcheias) e **3 contra 4**. No **deslocamento rítmico**, uma frase de três semicolcheias repetida cruza os tempos e "anda" pelo compasso, um recurso muito usado em viradas de bateria e em solos.'),
      { kind: 'rhythm', caption: 'Frase de 3 semicolcheias sobre 4/4', pattern: { bpm: 80, steps: 16, tracks: [{ sound: 'snare', pattern: 'x..x..x..x..x..x' }, { sound: 'kick', pattern: 'x...x...x...x...' }] } },
      { kind: 'exercise', steps: ['3 contra 2: conte "1-2-3-4-5-6" devagar; a mão direita bate no 1, 3 e 5 e a esquerda no 1 e 4. Depois acelere até soar como um ritmo só.', 'Toque a frase de 3 semicolcheias e conte os tempos em voz alta.'] },
    ],
  },
];
