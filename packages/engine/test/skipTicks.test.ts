import { describe, expect, it } from 'vitest';
import { buildDrumXml, skipTicksOf } from '../src/index.ts';

describe('scores record the leading bars they drop', () => {
  it('writes and reads the dropped ticks', () => {
    const xml = buildDrumXml({ title: 'T', artist: 'A', bpm: 120, hits: [{ tick: 40, kind: 'kick' }, { tick: 44, kind: 'snare' }] });
    expect(xml).toContain('<miscellaneous-field name="will-music-skip-ticks">32</miscellaneous-field>');
    expect(skipTicksOf(xml)).toBe(32);
    expect(skipTicksOf('<score-partwise/>')).toBe(0);
  });
});
