import * as alphaTab from '@coderline/alphatab';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { Cursor } from '../../lib/sheet/edit.ts';

export type SheetPlayerState = { ready: boolean; playing: boolean; speed: number; loop: { from: number; to: number } | null; countIn: boolean; metronome: boolean; error?: string };

export type SheetViewHandle = {
  playPause: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  /** Repeats measures [from, to] (1-based, inclusive); null plays everything once. */
  setLoop: (loop: { from: number; to: number } | null) => void;
  setCountIn: (on: boolean) => void;
  setMetronome: (on: boolean) => void;
  /** Plays the event under the cursor (hearing a note right after writing it). */
  preview: (at: Cursor) => void;
  print: () => void;
};

const BASE = import.meta.env.BASE_URL;

/**
 * Draws a MusicXML score with alphaTab and plays it with real instrument sounds (SoundFont). In the editor, a click
 * picks the note under the pointer and the cursor box marks the event being edited; in study mode the playback cursor
 * follows the music.
 */
export const SheetView = ({ xml, cursor, selected, onPick, interactive = false, handle, onState }: {
  xml: string;
  /** Where the next note goes (dashed box). */
  cursor?: Cursor | null;
  /** The note marks and accidentals apply to (solid box). */
  selected?: Cursor | null;
  onPick?: (at: Cursor) => void;
  /** Study mode: clicking moves the playback position. */
  interactive?: boolean;
  handle?: Ref<SheetViewHandle>;
  onState?: (state: SheetPlayerState) => void;
}) => {
  const host = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const api = useRef<alphaTab.AlphaTabApi | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedBox, setSelectedBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [rendered, setRendered] = useState(0);
  const state = useRef<SheetPlayerState>({ ready: false, playing: false, speed: 1, loop: null, countIn: false, metronome: false });
  const emit = (patch: Partial<SheetPlayerState>) => { state.current = { ...state.current, ...patch }; onState?.(state.current); };

  useEffect(() => {
    if (!host.current) return;
    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = `${BASE}font/`;
    settings.display.staveProfile = alphaTab.StaveProfile.Score;
    settings.display.layoutMode = alphaTab.LayoutMode.Page;
    settings.display.scale = window.innerWidth < 640 ? 0.8 : 1;
    settings.player.enablePlayer = true;
    settings.player.soundFont = `${BASE}soundfont/sonivox.sf2`;
    settings.player.enableCursor = true;
    settings.player.enableUserInteraction = interactive;
    settings.player.scrollElement = wrap.current ?? 'html,body';
    const instance = new alphaTab.AlphaTabApi(host.current, settings);
    api.current = instance;
    instance.renderFinished.on(() => setRendered((n) => n + 1));
    instance.playerReady.on(() => emit({ ready: true }));
    instance.playerStateChanged.on((e) => emit({ playing: e.state === alphaTab.synth.PlayerState.Playing }));
    instance.error.on((e) => { console.error('Partitura', e); emit({ error: 'Não foi possível desenhar ou tocar a partitura.' }); });
    return () => { instance.destroy(); api.current = null; };
  }, [interactive]);

  useEffect(() => {
    api.current?.load(new TextEncoder().encode(xml));
  }, [xml, interactive]);

  const beatAt = (at: Cursor) => api.current?.score?.tracks[0]?.staves[at.staff]?.bars[at.measure]?.voices[0]?.beats[at.event] ?? null;

  // The editing cursor: a box around the event being edited, from the drawn positions.
  const boxFor = (at: Cursor | null | undefined) => {
    const beat = at ? beatAt(at) : null;
    const bounds = beat ? api.current?.boundsLookup?.findBeat(beat)?.visualBounds : null;
    return bounds ? { x: bounds.x, y: bounds.y, w: Math.max(bounds.w, 14), h: bounds.h } : null;
  };
  useEffect(() => { setBox(boxFor(cursor)); }, [cursor?.staff, cursor?.measure, cursor?.event, rendered]);
  useEffect(() => { setSelectedBox(boxFor(selected)); }, [selected?.staff, selected?.measure, selected?.event, rendered]);

  useImperativeHandle(handle, () => ({
    playPause: () => api.current?.playPause(),
    stop: () => api.current?.stop(),
    setSpeed: (speed) => { if (api.current) api.current.playbackSpeed = speed; emit({ speed }); },
    setLoop: (loop) => {
      const a = api.current;
      const bars = a?.score?.masterBars;
      if (!a || !bars?.length) return;
      if (!loop) { a.playbackRange = null; a.isLooping = false; emit({ loop: null }); return; }
      const from = Math.max(1, Math.min(loop.from, bars.length));
      const to = Math.max(from, Math.min(loop.to, bars.length));
      const range = new alphaTab.synth.PlaybackRange();
      range.startTick = bars[from - 1]!.start;
      range.endTick = bars[to - 1]!.start + bars[to - 1]!.calculateDuration();
      a.playbackRange = range;
      a.isLooping = true;
      a.tickPosition = range.startTick;
      emit({ loop: { from, to } });
    },
    setCountIn: (on) => { if (api.current) api.current.countInVolume = on ? 1 : 0; emit({ countIn: on }); },
    setMetronome: (on) => { if (api.current) api.current.metronomeVolume = on ? 1 : 0; emit({ metronome: on }); },
    preview: (at) => { const beat = beatAt(at); if (beat && !beat.isRest && state.current.ready) api.current?.playBeat(beat); },
    print: () => api.current?.print(),
  }), []);

  const pick = (event: React.MouseEvent) => {
    if (!onPick || !host.current || !api.current?.boundsLookup) return;
    const rect = host.current.getBoundingClientRect();
    const beat = api.current.boundsLookup.getBeatAtPos(event.clientX - rect.left, event.clientY - rect.top);
    if (!beat) return;
    const bar = beat.voice.bar;
    onPick({ staff: bar.staff.index, measure: bar.index, event: beat.index });
  };

  return (
    <div ref={wrap} className="sheet-paper relative max-h-[70dvh] min-h-48 overflow-auto rounded-2xl border border-border bg-white p-2 text-black shadow-sm">
      <div className="relative" onClick={pick}>
        <div ref={host} />
        {selectedBox && <div aria-hidden className="pointer-events-none absolute rounded-md border-2 border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]" style={{ left: selectedBox.x - 4, top: selectedBox.y - 4, width: selectedBox.w + 8, height: selectedBox.h + 8 }} />}
        {box && <div aria-hidden className="pointer-events-none absolute rounded-md border-2 border-dashed border-sky-500" style={{ left: box.x - 4, top: box.y - 4, width: box.w + 8, height: box.h + 8 }} />}
      </div>
    </div>
  );
};
