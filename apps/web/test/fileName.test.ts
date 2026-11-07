import { describe, expect, it } from 'vitest';
import { guessFromFileName } from '../src/lib/fileName.ts';

describe('guessFromFileName', () => {
  it.each([
    ['Ton Carfi - Primeiros Passos (DVD Ton Carfi 20 Anos) - Ton Carfi (youtube)-G-118bpm-441hz.mp3', 'Primeiros Passos', 'Ton Carfi'],
    ['Preto no Branco - Ninguém Explica Deus (Ao Vivo) ft. Gabriela Rocha.mp3', 'Ninguém Explica Deus', 'Preto no Branco'],
    ['Green Day - Boulevard Of Broken Dreams [Official Music Video] [4K Upgrade].mp3', 'Boulevard Of Broken Dreams', 'Green Day'],
    ['IMPERFEITO  Coral Canto Jovem e Rayssa Andreoli - Seven Plus (youtube).mp3', 'Imperfeito', 'Coral Canto Jovem e Rayssa Andreoli'],
    ['ENCHE-ME (Clipe Oficial) ｜ Isaías Saad + Gabriela Rocha.mp3', 'Enche-me', 'Isaías Saad + Gabriela Rocha'],
    ['Minha Música.mp3', 'Minha Música', ''],
    ['WhatsApp Audio 2026-05-28 at 10.15.44-F-105bpm-441hz.mp3', 'WhatsApp Audio 2026-05-28 at 10.15.44', ''],
  ])('guesses %s', (name, title, artist) => {
    expect(guessFromFileName(name)).toEqual({ title, artist });
  });
});
