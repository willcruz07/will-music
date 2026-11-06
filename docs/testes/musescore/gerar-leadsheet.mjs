import { writeFileSync } from 'node:fs';
const out = process.argv[2];
const P = s => { const m = s.match(/^([A-G])(#|b)?(\d)$/); return {step:m[1], alter:m[2]==='#'?1:m[2]==='b'?-1:0, oct:+m[3]}; };
const pitch = s => { const p=P(s); return `<pitch><step>${p.step}</step>${p.alter?`<alter>${p.alter}</alter>`:''}<octave>${p.oct}</octave></pitch>`; };
const harm = (root, kind) => `<harmony><root><root-step>${root}</root-step></root><kind>${kind}</kind></harmony>`;
// melodia original: [nota, duração em semínimas, sílaba, silabic]
const bars = [
  {ch:['C','major'], notes:[['E4',1,'Es','begin'],['G4',1,'tu','middle'],['G4',1,'dan','middle'],['E4',1,'do','end']]},
  {ch:['A','minor'], notes:[['A4',1,'a','single'],['G4',1,'can','begin'],['E4',2,'ção','end']]},
  {ch:['F','major'], notes:[['F4',1,'pas','begin'],['A4',1,'so a','end'],['C5',1,'pas','begin'],['A4',1,'so','end']]},
  {ch:['G','major'], notes:[['G4',1,'vou','single'],['F4',1,'a','begin'],['E4',1,'pren','middle'],['D4',1,'der','end']]},
];
const type = d => d===1?'quarter':d===2?'half':'whole';
let voice = '';
bars.forEach((b,i)=>{
  voice += `<measure number="${i+1}">`;
  if(i===0) voice += `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>90</per-minute></metronome></direction-type><sound tempo="90"/></direction>`;
  voice += harm(...b.ch);
  for (const [n,d,syl,sb] of b.notes) voice += `<note>${pitch(n)}<duration>${d}</duration><type>${type(d)}</type><lyric number="1"><syllabic>${sb}</syllabic><text>${syl}</text></lyric></note>`;
  voice += `</measure>`;
});
// tablatura: formas abertas de violão [nota, corda, casa]
const shapes = [
  [['C3',5,3],['E3',4,2],['G3',3,0],['C4',2,1],['E4',1,0]],
  [['A2',5,0],['E3',4,2],['A3',3,2],['C4',2,1],['E4',1,0]],
  [['F2',6,1],['C3',5,3],['F3',4,3],['A3',3,2],['C4',2,1],['F4',1,1]],
  [['G2',6,3],['B2',5,2],['D3',4,0],['G3',3,0],['D4',2,3],['G4',1,3]],
];
const tuning = ['E2','A2','D3','G3','B3','E4'];
let tab = '';
shapes.forEach((sh,i)=>{
  tab += `<measure number="${i+1}">`;
  if(i===0) tab += `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines>${tuning.map((t,k)=>{const p=P(t);return `<staff-tuning line="${k+1}"><tuning-step>${p.step}</tuning-step><tuning-octave>${p.oct}</tuning-octave></staff-tuning>`}).join('')}</staff-details></attributes>`;
  sh.forEach(([n,s,f],k)=>{ tab += `<note>${k?'<chord/>':''}${pitch(n)}<duration>4</duration><type>whole</type><notations><technical><string>${s}</string><fret>${f}</fret></technical></notations></note>`; });
  tab += `</measure>`;
});
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>Teste de lead sheet</work-title></work><identification><creator type="composer">Gerado automaticamente</creator></identification>
<part-list><score-part id="P1"><part-name>Voz</part-name></score-part><score-part id="P2"><part-name>Violão</part-name></score-part></part-list>
<part id="P1">${voice}</part><part id="P2">${tab}</part></score-partwise>`;
writeFileSync(out, xml);
console.log('ok', xml.length, 'bytes');
