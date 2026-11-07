import { describe, expect, it } from 'vitest';
import { isUsefulTranscript, transcriptToLines } from '../src/lib/transcript.ts';

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
