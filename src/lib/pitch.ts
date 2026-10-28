"use client";

import { PitchDetector } from "pitchy";
import { micSession } from "./audio";

/** A low hum sits near 65 Hz (C2); a whistle can reach 4 kHz. */
const MIN_HZ = 55;
const MAX_HZ = 4200;
/** How periodic a window must be to count as a note (McLeod's clarity, 0–1). */
const CLARITY = 0.9;
/** About 85 ms at 48 kHz: two periods of the lowest hum. */
export const WINDOW = 4096;
/** Readings in the median: one stray frame can't flip the note. */
const SMOOTH = 5;
/** Unclear frames to ride through before calling it silence. */
const GAP = 4;

const toMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

/**
 * Pitch from windows of audio, as fractional MIDI: the McLeod pitch method
 * (via pitchy), which is far less prone than plain autocorrelation to jumping
 * an octave or a fifth on a hum, whose fundamental is weak next to its
 * overtones. Shared by everything that listens.
 */
export class PitchTracker {
  private detector = PitchDetector.forFloat32Array(WINDOW);
  private recent: number[] = [];
  private gap = 0;

  constructor() {
    this.detector.minVolumeDecibels = -50;
  }

  /** One window, unsmoothed. */
  detect(buf: Float32Array, rate: number): number | null {
    const [hz, clarity] = this.detector.findPitch(buf, rate);
    if (clarity < CLARITY || hz < MIN_HZ || hz > MAX_HZ) return null;
    return toMidi(hz);
  }

  /** One window in, the steadied pitch out (null once it's been quiet a moment). */
  push(buf: Float32Array, rate: number): number | null {
    const m = this.detect(buf, rate);
    if (m === null) {
      if (++this.gap >= GAP) this.recent.length = 0;
      return this.recent.length ? median(this.recent) : null;
    }
    this.gap = 0;
    this.recent.push(m);
    if (this.recent.length > SMOOTH) this.recent.shift();
    return median(this.recent);
  }
}

/**
 * Live pitch from the microphone, steadied, as fractional MIDI (null when
 * quiet or unclear). Resolves with a function that stops listening.
 */
export async function listen(onPitch: (midi: number | null) => void): Promise<() => void> {
  micSession(true);
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (err) {
    micSession(false);
    throw err;
  }
  // A context of its own, made once recording has begun: iOS can change the
  // hardware rate when the mic opens, and a context made before may keep the
  // old one, putting every reading off by a semitone or more (WebKit 154538, 244203).
  const c = new AudioContext();
  if (c.state !== "running") await c.resume().catch(() => {});
  const resume = () => c.state !== "running" && void c.resume().catch(() => {});
  for (const g of ["touchend", "click"]) window.addEventListener(g, resume, { passive: true });

  const src = c.createMediaStreamSource(stream);
  const analyser = c.createAnalyser();
  analyser.fftSize = WINDOW;
  // Keep the graph pulled without making a sound.
  const sink = c.createGain();
  sink.gain.value = 0;
  src.connect(analyser).connect(sink).connect(c.destination);

  const tracker = new PitchTracker();
  const buf = new Float32Array(WINDOW);
  // If the audio clock runs at a different speed from the wall clock, the
  // context has the wrong rate: scale readings by the difference.
  const t0 = { ctx: c.currentTime, wall: performance.now() };
  let drift = 1;
  let raf = 0;
  const tick = () => {
    const wall = (performance.now() - t0.wall) / 1000;
    if (wall > 1) {
      const r = (c.currentTime - t0.ctx) / wall;
      drift = Math.abs(r - 1) > 0.03 && r > 0.8 && r < 1.25 ? r : 1;
    }
    analyser.getFloatTimeDomainData(buf);
    const m = tracker.push(buf, c.sampleRate);
    onPitch(m === null ? null : m + 12 * Math.log2(drift));
    raf = requestAnimationFrame(tick);
  };
  tick();

  return () => {
    cancelAnimationFrame(raf);
    for (const g of ["touchend", "click"]) window.removeEventListener(g, resume);
    src.disconnect();
    for (const t of stream.getTracks()) t.stop();
    void c.close().catch(() => {});
    micSession(false);
  };
}
