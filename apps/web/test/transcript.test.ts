import { describe, expect, it } from 'vitest';
import { describeTranscription, isUsefulTranscript, leadingSilence, transcriptToLines, windowCount, wordsToSegments } from '../src/lib/transcript.ts';

describe('whisper transcript', () => {
  it('turns whisper chunks into timed lines', () => {
    expect(transcriptToLines([
      { timestamp: [12.3, 15], text: ' Ninguém explica Deus ' },
      { timestamp: [15, 16], text: '[Música]' },
      { timestamp: [16, 17], text: ' ♪ ' },
      { timestamp: [20, null], text: 'Aleluia' },
    ])).toEqual([{ start: 12.3, text: 'Ninguém explica Deus' }, { start: 20, text: 'Aleluia' }]);
  });

  it('splits long chunks at a word boundary', () => {
    const lines = transcriptToLines([{ timestamp: [0, 10], text: `${'a'.repeat(40)} ${'b'.repeat(40)}` }]);
    expect(lines.map((l) => l.text)).toEqual(['a'.repeat(40), 'b'.repeat(40)]);
    expect(lines[1]!.start).toBeCloseTo(5, 0);
  });

  it('rejects useless transcripts', () => {
    expect(isUsefulTranscript([{ start: 0, text: '...' }])).toBe(false);
    expect(isUsefulTranscript([{ start: 0, text: 'um' }, { start: 1, text: 'dois' }, { start: 2, text: 'três' }])).toBe(true);
  });
});

describe('review fixes: whisper hallucinations', () => {
  it('rejects transcripts made of a repeated phrase', () => {
    const lines = Array.from({ length: 6 }, (_, i) => ({ start: i * 30, text: i % 2 ? 'Obrigado.' : 'Legendas pela comunidade Amara.org' }));
    expect(isUsefulTranscript(lines)).toBe(false);
  });
});

describe('whisper decoding loops', () => {
  const loop = (n: number) => Array.from({ length: n }, () => 'o que é').join(' ');

  it('drops segments where whisper got stuck repeating a phrase', () => {
    expect(transcriptToLines([
      { timestamp: [0, 30], text: `O que é ${loop(30)}` },
      { timestamp: [30, 60], text: `${loop(20)} é Deus vai ver` },
      { timestamp: [61, 64], text: ' Ninguém explica Deus ' },
    ])).toEqual([{ start: 61, text: 'Ninguém explica Deus' }]);
  });

  it('keeps lyrics that legitimately repeat a phrase a couple of times', () => {
    expect(transcriptToLines([{ timestamp: [5, 9], text: 'O que é, o que é? Somos nós' }]))
      .toEqual([{ start: 5, text: 'O que é, o que é? Somos nós' }]);
  });

  it('collapses a short stutter inside an otherwise good segment', () => {
    expect(transcriptToLines([{ timestamp: [0, 6], text: 'Santo santo santo santo santo santo é o Senhor Deus do universo inteiro' }]))
      .toEqual([{ start: 0, text: 'Santo santo é o Senhor Deus do universo inteiro' }]);
  });
});

describe('leading silence', () => {
  it('finds where the voice starts, with a small margin', () => {
    const rate = 16000;
    const audio = new Float32Array(rate * 10);
    for (let i = rate * 6; i < audio.length; i++) audio[i] = Math.sin(i / 10) * 0.3;
    expect(leadingSilence(audio, rate)).toBeCloseTo(5.5, 1);
  });

  it('is zero when there is sound right away or no sound at all', () => {
    const rate = 16000;
    expect(leadingSilence(new Float32Array(rate * 3).fill(0.2), rate)).toBe(0);
    expect(leadingSilence(new Float32Array(rate * 3), rate)).toBe(0);
  });
});

describe('word timestamps to lines', () => {
  const w = (text: string, start: number, end: number) => ({ text, timestamp: [start, end] as [number, number] });

  it('starts each line at its first word and breaks on pauses', () => {
    expect(wordsToSegments([
      w(' Ninguém', 12.4, 12.9), w(' explica', 12.9, 13.5), w(' Deus', 13.5, 14.2),
      w(' Preciso', 16.1, 16.6), w(' de', 16.6, 16.7), w(' ti', 16.7, 17.3),
    ])).toEqual([
      { timestamp: [12.4, 14.2], text: 'Ninguém explica Deus' },
      { timestamp: [16.1, 17.3], text: 'Preciso de ti' },
    ]);
  });

  it('breaks after sentence punctuation even without a pause', () => {
    expect(wordsToSegments([w(' Aleluia.', 1, 1.5), w(' Santo', 1.5, 2), w(' é', 2, 2.2)]).map((s) => s.text))
      .toEqual(['Aleluia.', 'Santo é']);
  });

  it('keeps lines short when the singing has no pauses', () => {
    const words = Array.from({ length: 30 }, (_, i) => w(' palavra', i * 0.3, i * 0.3 + 0.3));
    const segments = wordsToSegments(words);
    expect(segments.length).toBeGreaterThan(1);
    for (const s of segments) expect(s.text.length).toBeLessThanOrEqual(45);
    expect(segments[1]!.timestamp[0]).toBe(words[segments[0]!.text.split(' ').length]!.timestamp[0]);
  });
});

describe('transcription progress', () => {
  it('counts the 30 s windows the pipeline cuts (20 s apart)', () => {
    expect(windowCount(16000 * 25, 16000)).toBe(1);
    expect(windowCount(16000 * 30, 16000)).toBe(1);
    expect(windowCount(16000 * 31, 16000)).toBe(2);
    expect(windowCount(16000 * 180, 16000)).toBe(9);
  });

  it('a model already on the device is "preparing", not downloading', () => {
    expect(describeTranscription({ stage: 'load' })).toEqual({ label: 'Preparando o modelo da letra' });
    expect(describeTranscription({ stage: 'download', loaded: 40e6, total: 80e6 })).toEqual({ label: 'Baixando o modelo da letra (40 MB de 80 MB)', fraction: 0.5 });
  });

  it('shows which part is being listened to and the latest words', () => {
    expect(describeTranscription({ stage: 'listen', done: 0, total: 9, heard: '' })).toEqual({ label: 'Transcrevendo a letra: trecho 1 de 9', fraction: 0, detail: undefined });
    expect(describeTranscription({ stage: 'listen', done: 9, total: 9, heard: 'aleluia' })).toEqual({ label: 'Transcrevendo a letra: finalizando', fraction: 1, detail: '“…aleluia”' });
  });
});
