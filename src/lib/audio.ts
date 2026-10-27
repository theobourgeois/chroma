"use client";

import { parseNote, pick } from "./music";

/** Sampled instruments plus a synthesized pure tone. "mixed" picks one per note. */
export type Sound = "piano" | "guitar" | "cello" | "violin" | "flute" | "clarinet" | "pure" | "mixed";
export const SOUNDS: { id: Sound; name: string }[] = [
  { id: "piano", name: "Piano" },
  { id: "guitar", name: "Guitar" },
  { id: "cello", name: "Cello" },
  { id: "violin", name: "Violin" },
  { id: "flute", name: "Flute" },
  { id: "clarinet", name: "Clarinet" },
  { id: "pure", name: "Pure tone" },
  { id: "mixed", name: "Mixed" },
];

type Sampled = Exclude<Sound, "pure" | "mixed">;

/** Files under public/samples (scripts/samples.mts), and how far each set can stretch. */
const SETS: Record<Sampled, { notes: string[]; lo: number; hi: number }> = {
  piano: {
    notes: [2, 3, 4, 5, 6].flatMap((o) => [`C${o}`, `Ds${o}`, `Fs${o}`, `A${o}`]).concat("C7"),
    lo: 33,
    hi: 99,
  },
  guitar: { notes: ["A2", "C3", "Ds3", "Fs3", "A3", "C4", "Ds4", "Fs4", "A4", "C5", "D5"], lo: 40, hi: 77 },
  cello: {
    notes: ["C2", "Ds2", "Gs2", "B2", "D3", "F3", "Gs3", "B3", "D4", "F4", "Gs4", "B4", "C5"],
    lo: 36,
    hi: 74,
  },
  violin: {
    notes: ["G3", "C4", "E4", "G4", "A4", "C5", "E5", "G5", "A5", "C6", "E6", "G6", "A6", "C7"],
    lo: 55,
    hi: 98,
  },
  flute: { notes: ["C4", "E4", "A4", "C5", "E5", "A5", "C6", "E6", "A6", "C7"], lo: 60, hi: 98 },
  clarinet: { notes: ["D3", "F3", "As3", "D4", "F4", "As4", "D5", "F5", "As5", "D6"], lo: 50, hi: 88 },
};
const SAMPLED = Object.keys(SETS) as Sampled[];
const VERSION = 1;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const live = new Set<{ stop: (at: number) => void }>();

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** Plays through the ringer switch on iOS 17+, the way a music app does. */
function setSession(type: "playback" | "play-and-record") {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session) session.type = type;
}

export function audio(): AudioContext {
  if (!ctx) {
    setSession("playback");
    ctx = new AudioContext({ latencyHint: "interactive" });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

/** Call from a tap: iOS only starts audio inside a user gesture. */
export function unlock() {
  const c = audio();
  if (c.state === "running") return;
  void c.resume();
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start();
}

export function micSession(on: boolean) {
  setSession(on ? "play-and-record" : "playback");
}

function load(set: Sampled, note: string): Promise<AudioBuffer | null> {
  const key = `${set}/${note}`;
  let p = buffers.get(key);
  if (!p) {
    p = fetch(`/samples/${key}.mp3?v=${VERSION}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => audio().decodeAudioData(data))
      .catch(() => {
        buffers.delete(key);
        return null;
      });
    buffers.set(key, p);
  }
  return p;
}

/** Fetches and decodes a whole set so the first question doesn't wait. */
export function preload(sound: Sound) {
  const sets = sound === "mixed" ? SAMPLED : sound === "pure" ? [] : [sound];
  return Promise.all(sets.flatMap((s) => SETS[s].notes.map((n) => load(s, n))));
}

function resolve(sound: Sound, midi: number): Sampled | "pure" {
  if (sound === "pure") return "pure";
  if (sound === "mixed") {
    const fits = SAMPLED.filter((s) => midi >= SETS[s].lo && midi <= SETS[s].hi);
    return fits.length ? pick(fits) : "piano";
  }
  return midi >= SETS[sound].lo && midi <= SETS[sound].hi ? sound : "piano";
}

export type Tone = { midi: number; at?: number; dur?: number; gain?: number };

/**
 * Schedules notes on the audio clock. `at` is seconds from now. Resolves once
 * the samples are ready with the context time the first note sounds.
 */
export async function play(notes: Tone[], sound: Sound): Promise<number> {
  const c = audio();
  if (c.state !== "running") await c.resume().catch(() => {});
  const picked = notes.map((n) => ({ ...n, set: resolve(sound, n.midi) }));
  const ready = await Promise.all(
    picked.map(async (n) => {
      if (n.set === "pure") return { n, buf: null, base: 0 };
      const set = SETS[n.set];
      // Nearest recorded note; playbackRate covers the rest.
      let best = set.notes[0];
      for (const name of set.notes) {
        const d = Math.abs(parseNote(name) - n.midi);
        if (d < Math.abs(parseNote(best) - n.midi)) best = name;
      }
      return { n, buf: await load(n.set, best), base: parseNote(best) };
    }),
  );
  const start = c.currentTime + 0.04;
  for (const { n, buf, base } of ready) {
    const at = start + (n.at ?? 0);
    const dur = n.dur ?? 0.8;
    const level = (n.gain ?? 1) * (buf ? 0.7 : 0.4);
    const g = c.createGain();
    g.connect(out!);
    let node: AudioScheduledSourceNode;
    if (buf) {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 2 ** ((n.midi - base) / 12);
      g.gain.setValueAtTime(level, at);
      node = src;
    } else {
      const osc = c.createOscillator();
      osc.frequency.value = 440 * 2 ** ((n.midi - 69) / 12);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(level, at + 0.02);
      node = osc;
    }
    node.connect(g);
    // A 100 ms release, as in the training study's tone clips.
    g.gain.setValueAtTime(level, at + dur - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    node.start(at);
    node.stop(at + dur + 0.02);
    const handle = {
      stop: (when: number) => {
        g.gain.cancelScheduledValues(when);
        g.gain.setTargetAtTime(0, when, 0.015);
        try {
          node.stop(when + 0.1);
        } catch {}
      },
    };
    live.add(handle);
    node.onended = () => live.delete(handle);
  }
  return start + Math.min(...notes.map((n) => n.at ?? 0));
}

export function stopAll() {
  if (!ctx) return;
  for (const h of live) h.stop(ctx.currentTime);
  live.clear();
}

/** Converts an audio-clock time to performance.now() time. */
export function toPerf(t: number): number {
  const c = audio();
  return performance.now() + (t - c.currentTime) * 1000;
}

/**
 * A Shepard–Risset glissando: a tone that keeps falling without arriving
 * anywhere. Washes out the pitches you just listened to before an unaided level.
 */
export function shepard(seconds: number): { done: Promise<void>; stop: () => void } {
  const c = audio();
  const rate = c.sampleRate;
  const len = Math.floor(seconds * rate);
  const buf = c.createBuffer(1, len, rate);
  const data = buf.getChannelData(0);
  const N = 8;
  const fmin = 32;
  const octaveSecs = 6;
  const phase = new Float64Array(N);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    let s = 0;
    for (let k = 0; k < N; k++) {
      const pos = (((k - t / octaveSecs) % N) + N) % N;
      const f = fmin * 2 ** pos;
      phase[k] += (2 * Math.PI * f) / rate;
      const amp = Math.exp(-((pos - N / 2) ** 2) / 2.2);
      s += amp * Math.sin(phase[k]);
    }
    const edge = Math.min(1, t / 0.8, (seconds - t) / 0.8);
    data[i] = s * 0.12 * edge;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  src.connect(g).connect(out!);
  src.start();
  const done = new Promise<void>((r) => (src.onended = () => r()));
  return {
    done,
    stop: () => {
      g.gain.setTargetAtTime(0, c.currentTime, 0.05);
      try {
        src.stop(c.currentTime + 0.3);
      } catch {}
    },
  };
}
