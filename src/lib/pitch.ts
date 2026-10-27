"use client";

import { audio, micSession } from "./audio";

/** Live pitch from the microphone, as fractional MIDI (or null when quiet or unclear). */
export async function listen(onPitch: (midi: number | null, level: number) => void): Promise<() => void> {
  micSession(true);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const c = audio();
  if (c.state !== "running") await c.resume();
  const src = c.createMediaStreamSource(stream);
  const analyser = c.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    const { freq, level } = detect(buf, c.sampleRate);
    onPitch(freq ? 69 + 12 * Math.log2(freq / 440) : null, level);
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(raf);
    src.disconnect();
    for (const t of stream.getTracks()) t.stop();
    micSession(false);
  };
}

/** Autocorrelation with parabolic peak refinement; good enough for a sung note. */
function detect(buf: Float32Array, rate: number): { freq: number | null; level: number } {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return { freq: null, level: rms };

  // Search lags for 70–1100 Hz.
  const minLag = Math.floor(rate / 1100);
  const maxLag = Math.min(Math.floor(rate / 70), n - 1);
  const corr = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < n - lag; i++) s += buf[i] * buf[i + lag];
    corr[lag] = s / (n - lag);
  }
  let energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
  energy /= n;

  // First peak that's near the best one: avoids picking an octave below.
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) if (corr[lag] > best) best = corr[lag];
  if (best / energy < 0.5) return { freq: null, level: rms };
  let lag = minLag;
  for (let l = minLag + 1; l < maxLag; l++) {
    if (corr[l] > 0.9 * best && corr[l] >= corr[l - 1] && corr[l] >= corr[l + 1]) {
      lag = l;
      break;
    }
  }
  const a = corr[lag - 1] ?? 0;
  const b = corr[lag];
  const c = corr[lag + 1] ?? 0;
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return { freq: rate / (lag + shift), level: rms };
}
