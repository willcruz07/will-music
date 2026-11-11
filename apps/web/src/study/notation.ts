import type { SynthEvent } from '../lib/synth.ts';

export type StudyNote = {
  step?: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave?: number; alter?: number;
  type: 'whole' | 'half' | 'quarter' | 'eighth' | '16th'; dot?: boolean;
  tuplet?: boolean; tie?: 'start' | 'stop' | 'continue';
  accidental?: 'natural' | 'sharp' | 'flat'; articulation?: 'staccato' | 'accent';
  drum?: 'kick' | 'snare' | 'hihat';
};
export type StudyScore = {
  title: string; bpm: number; meter: [number, number]; fifths?: number;
  /** BPM counts this written unit; quarter by default, dotted quarter in compound examples. */
  pulse?: 'quarter' | 'dotted-quarter';
  parts: { name: string; clef: 'treble' | 'bass' | 'percussion'; measures: StudyNote[][] }[];
};
const LENGTH = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25 };
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const escape = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
export const noteBeats = (n: StudyNote): number => LENGTH[n.type] * (n.dot ? 1.5 : 1) * (n.tuplet ? 2 / 3 : 1);
export const measureBeats = (s: StudyScore): number => s.meter[0] * 4 / s.meter[1];

/** Written pitches (including spelling) and durations are the single source for engraving and sound. */
export const notationExample = (s: StudyScore): { xml: string; events: SynthEvent[]; duration: number } => {
  if (!Number.isFinite(s.bpm) || s.bpm <= 0 || s.meter.some(n => !Number.isInteger(n) || n <= 0) || !s.parts.length) throw new Error('Referência de andamento, compasso ou partes inválida.');
  const quarterSeconds = 60 / s.bpm / (s.pulse === 'dotted-quarter' ? 1.5 : 1);
  const bar = measureBeats(s);
  const events: SynthEvent[] = [];
  const parts = s.parts.map((p, index) => {
    const ties = new Map<number, SynthEvent>();
    const measures = p.measures.map((notes, m) => {
      const total = notes.reduce((sum, n) => sum + noteBeats(n), 0);
      if (Math.abs(total - bar) > 0.00001) throw new Error(`Compasso ${m + 1} de ${s.title}: ${total} tempos; esperado ${bar}.`);
      let beat = 0;
      const body = notes.map((n, i) => {
        const beats = noteBeats(n);
        if (n.step && !Number.isInteger(n.octave)) throw new Error('Uma nota escrita precisa indicar sua oitava.');
        const pitch = n.step ? (n.octave! + 1) * 12 + PC[n.step] + (n.alter ?? 0) : undefined;
        const time = (m * bar + beat) * quarterSeconds;
        const dur = beats * quarterSeconds;
        if (pitch !== undefined || n.drum) {
          const held = pitch === undefined ? undefined : ties.get(pitch);
          if ((n.tie === 'stop' || n.tie === 'continue') && held) held.dur += dur;
          else {
            const event: SynthEvent = { time, dur: n.articulation === 'staccato' ? dur * 0.45 : dur, ...(n.drum ? { drum: n.drum } : { pitch }), velocity: n.articulation === 'accent' ? 1 : 0.65 };
            events.push(event);
            if (pitch !== undefined && (n.tie === 'start' || n.tie === 'continue')) ties.set(pitch, event);
          }
          if (pitch !== undefined && n.tie === 'stop') ties.delete(pitch);
        }
        beat += beats;
        const tieTypes = n.tie === 'continue' ? ['stop', 'start'] : n.tie ? [n.tie] : [];
        const tied = tieTypes.map(t => `<tied type="${t}"/>`).join('');
        const tupletStart = n.tuplet && !notes[i - 1]?.tuplet;
        const tupletStop = n.tuplet && !notes[i + 1]?.tuplet;
        const tuplet = `${tupletStart ? '<tuplet type="start" bracket="yes"/>' : ''}${tupletStop ? '<tuplet type="stop"/>' : ''}`;
        const articulation = n.articulation ? `<articulations><${n.articulation}/></articulations>` : '';
        const content = n.drum ? '<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>' : n.step ? `<pitch><step>${n.step}</step>${n.alter ? `<alter>${n.alter}</alter>` : ''}<octave>${n.octave}</octave></pitch>` : '<rest/>';
        return `<note>${content}<duration>${Math.round(beats * 48)}</duration>${tieTypes.map(t => `<tie type="${t}"/>`).join('')}<type>${n.type}</type>${n.dot ? '<dot/>' : ''}${n.accidental ? `<accidental>${n.accidental}</accidental>` : ''}${n.tuplet ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>' : ''}${tied || tuplet || articulation ? `<notations>${tied}${tuplet}${articulation}</notations>` : ''}</note>`;
      }).join('');
      const sign = p.clef === 'bass' ? 'F' : p.clef === 'percussion' ? 'percussion' : 'G';
      const attrs = m === 0 ? `<attributes><divisions>48</divisions><key><fifths>${s.fifths ?? 0}</fifths></key><time><beats>${s.meter[0]}</beats><beat-type>${s.meter[1]}</beat-type></time><clef><sign>${sign}</sign>${p.clef === 'percussion' ? '' : `<line>${p.clef === 'bass' ? 4 : 2}</line>`}</clef></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit>${s.pulse === 'dotted-quarter' ? '<beat-unit-dot/>' : ''}<per-minute>${s.bpm}</per-minute></metronome></direction-type><sound tempo="${60 / quarterSeconds}"/></direction>` : '';
      return `<measure number="${m + 1}">${attrs}${body}${m === p.measures.length - 1 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ''}</measure>`;
    }).join('');
    return `<part id="P${index + 1}">${measures}</part>`;
  }).join('');
  return { xml: `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escape(s.title)}</work-title></work><part-list>${s.parts.map((p, i) => `<score-part id="P${i + 1}"><part-name>${escape(p.name)}</part-name></score-part>`).join('')}</part-list>${parts}</score-partwise>`, events: events.sort((a, b) => a.time - b.time), duration: Math.max(0, ...s.parts.map(p => p.measures.length * bar * quarterSeconds)) };
};
