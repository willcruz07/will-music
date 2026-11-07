import type { Lesson } from '../types.ts';

const t = (text: string) => ({ kind: 'text' as const, text });

export const ESTILOS: Lesson[] = [
  {
    id: 's-louvor',
    track: 'estilos',
    level: 'iniciante',
    title: 'Louvor contemporâneo (worship)',
    summary: 'Dinâmica, pads e progressões do louvor atual.',
    blocks: [
      t('O louvor contemporâneo vive de **dinâmica**: começa pequeno (voz e teclado), cresce até o clímax com a banda toda e volta ao íntimo. A harmonia é simples (I, IV, V, vi), e a riqueza vem do **arranjo**: pads de teclado, guitarras com delay e baixo que sustenta.'),
      { kind: 'progression', name: 'Base do louvor', degrees: ['I', 'V', 'vi', 'IV'], key: 'E' },
      { kind: 'progression', name: 'Começando no IV', degrees: ['IV', 'I', 'V', 'vi7'], key: 'E' },
      { kind: 'tip', text: 'Use **sus2 e sus4** e o **I/3** (com a terça no baixo) para dar movimento sem trocar de acorde.' },
    ],
  },
  {
    id: 's-bossa',
    track: 'estilos',
    level: 'intermediario',
    title: 'Bossa nova',
    summary: 'A batida do violão e as progressões cheias de sétimas.',
    blocks: [
      t('A bossa nova (João Gilberto, Tom Jobim) une a harmonia do jazz ao balanço do samba tocado baixinho. No violão, o **polegar** marca o baixo nos tempos (como o surdo) e os **dedos** tocam o acorde em síncope.'),
      { kind: 'rhythm', caption: 'Batida de bossa: polegar e dedos', pattern: { bpm: 70, steps: 16, tracks: [{ sound: 'kick', pattern: 'x...x...x...x...', label: 'Polegar' }, { sound: 'snare', pattern: 'x..x..x...x..x..', label: 'Dedos' }] } },
      { kind: 'progression', name: 'Progressão típica de bossa', degrees: ['I7M', 'V7/ii', 'ii7(9)', 'subV7', 'I7M'], key: 'C' },
      { kind: 'progression', name: 'ii–V em cadeia', degrees: ['iii7', 'V7/ii', 'ii7', 'V7(13)', 'I6(9)'], key: 'F' },
    ],
  },
  {
    id: 's-samba-pagode',
    track: 'estilos',
    level: 'intermediario',
    title: 'Samba e pagode',
    summary: 'O tempo forte no 2, o cavaco e o baixo de partido.',
    blocks: [
      t('No samba o pulso é em **2/4**, com o **surdo marcando o segundo tempo**. O **cavaquinho** faz a "levada" em semicolcheias com acentos sincopados, e o violão de 7 cordas faz as **baixarias** (linhas de baixo melódicas que ligam os acordes). No pagode a harmonia usa muito **dominantes secundários** e **diminutos de passagem**.'),
      { kind: 'rhythm', caption: 'Levada de cavaco (acentos)', pattern: { bpm: 96, steps: 16, tracks: [{ sound: 'snare', pattern: 'x.xx.x.xx.xx.x.x', label: 'Cavaco' }, { sound: 'kick', pattern: '....x.......x...', label: 'Surdo (no 2)' }] } },
      { kind: 'progression', name: 'Progressão de samba (com V7 secundário e diminuto)', degrees: ['I', 'V7/ii', 'ii7', 'V7', 'I', 'V7/IV', 'IV', '#iv°7', 'I'], key: 'D' },
    ],
  },
  {
    id: 's-mpb',
    track: 'estilos',
    level: 'avancado',
    title: 'MPB',
    summary: 'Melodias longas, harmonia rica e muitas modulações.',
    blocks: [
      t('A MPB herdou da bossa a harmonia com **tétrades e tensões**, e da canção a **melodia longa**. São marcas do estilo: **empréstimo modal**, **modulações para tons vizinhos**, **baixos cromáticos** e acordes com a melodia na tensão (a melodia cantando a 9ª ou a 11ª do acorde).'),
      { kind: 'progression', name: 'Cores da MPB', degrees: ['I7M', 'iv6', 'iii7', 'bIII7M', 'ii7', 'subV7', 'I7M'], key: 'G' },
      { kind: 'tip', text: 'Ao tirar uma MPB, preste atenção na **nota da melodia** sobre cada acorde: muitas vezes é ela que dá o nome ao acorde (C7M(9) porque a melodia está no Ré).' },
    ],
  },
  {
    id: 's-rock',
    track: 'estilos',
    level: 'iniciante',
    title: 'Rock',
    summary: 'Power chords, riffs e a pentatônica.',
    blocks: [
      t('O rock se apoia nos **power chords** (tônica e quinta, sem terça, escritos "5": E5, A5), em **riffs** repetidos e no solo com a **pentatônica** e a escala de **blues**. Harmonias com **bVII** e **bVI** (empréstimo modal) dão o som "épico".'),
      { kind: 'chords', chords: ['E5', 'G5', 'A5', 'C5', 'D5'], caption: 'Power chords' },
      { kind: 'progression', name: 'Rock com bVII', degrees: ['I', 'bVII', 'IV', 'I'], key: 'A' },
      { kind: 'rhythm', caption: 'Groove de rock', pattern: { bpm: 120, steps: 16, tracks: [{ sound: 'hihat', pattern: 'x.x.x.x.x.x.x.x.' }, { sound: 'snare', pattern: '....x.......x...' }, { sound: 'kick', pattern: 'x...x...x.x.....' }] } },
    ],
  },
  {
    id: 's-groove-funk',
    track: 'estilos',
    level: 'intermediario',
    title: 'Groove, funk e soul',
    summary: 'Um acorde, muito balanço: semicolcheias e espaço.',
    blocks: [
      t('No funk e no soul a música pode ficar **um acorde só** (geralmente um m7 ou um 7(9)) por muito tempo; o interesse está no **ritmo**. A guitarra faz "chicken scratch" (semicolcheias abafadas com alguns acordes soando), o baixo faz linhas com **síncope e pausas**, e a bateria toca **ghost notes**.'),
      { kind: 'chords', chords: ['Em7', 'E7(9)', 'A7(9)', 'Dm7(9)'], caption: 'Acordes típicos do funk' },
      { kind: 'scale', scale: 'dorian', root: 'E', caption: 'O dórico é a escala do funk menor.' },
      { kind: 'rhythm', caption: 'Funk em semicolcheias', pattern: { bpm: 98, steps: 16, tracks: [{ sound: 'hihat', pattern: 'xxxxxxxxxxxxxxxx' }, { sound: 'snare', pattern: '....x..x.x..x...' }, { sound: 'kick', pattern: 'x..x..x...x.....' }] } },
    ],
  },
  {
    id: 's-rnb',
    track: 'estilos',
    level: 'avancado',
    title: 'R&B e neo-soul',
    summary: 'Tensões, groove atrás do tempo e voicings abertos.',
    blocks: [
      t('O R&B moderno e o neo-soul (D’Angelo, Erykah Badu) usam **acordes com 9, 11 e 13** o tempo todo, progressões que giram por **ii–V** e **tônicas menores**, e um groove tocado **atrás do tempo** (laid back). A voz explora **melismas** sobre a pentatônica.'),
      { kind: 'progression', name: 'Progressão neo-soul', degrees: ['IV7M(9)', 'iii7', 'vi7(9)', 'V7/ii', 'ii7(9)', 'V7sus4'], key: 'Eb' },
      { kind: 'chords', chords: ['Ebm7(9)', 'Ab7(13)', 'Db7M(9)', 'Bbm7(11)'], caption: 'Cores do neo-soul' },
    ],
  },
  {
    id: 's-gospel-americano',
    track: 'estilos',
    level: 'pro',
    title: 'Gospel americano: o estilo de tocar',
    summary: 'Shout, reharm, chops e a banda que segue o culto.',
    blocks: [
      t('O gospel americano (black gospel) tem uma linguagem própria, construída na igreja: a banda **acompanha o momento** (pregação, oração, celebração) e responde ao líder. Elementos principais:'),
      { kind: 'list', items: ['**Shout / praise break:** trecho rápido e intenso em semicolcheias, geralmente sobre uma progressão curta, para celebração.', '**Rearmonização constante:** passing chords, 2-5 em cadeia, diminutos e trítonos (veja **Gospel chords** em Teclado).', '**Bateria com chops** e viradas lineares nos espaços (veja **Gospel chops** em Bateria).', '**Órgão Hammond** com drawbars e alavanca do Leslie para crescer a intensidade.', '**Modulações** de meio tom ou um tom subindo no final da música para dar o clímax.'] },
      { kind: 'progression', name: 'Progressão de shout', degrees: ['i7', 'iv7', 'V7(#9)', 'i7'], mode: 'minor', key: 'F' },
      { kind: 'progression', name: 'Final gospel: IV – iv e a volta pelo ii–V', degrees: ['IV7M', 'iv6', 'iii7', 'V7/ii', 'ii7', 'V7sus4', 'I6(9)'], key: 'Db' },
    ],
  },
];
