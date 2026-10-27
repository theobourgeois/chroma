/**
 * Downloads the instrument recordings and trims them into short mono clips
 * under public/samples/<instrument>/<note>.mp3. Run once; the output is committed.
 *
 * Piano: Salamander Grand Piano (Alexander Holm, CC-BY 3.0).
 * Others: nbrosowsky/tonejs-instruments (CC-BY 3.0).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SALAMANDER = "https://tonejs.github.io/audio/salamander";
const TONEJS = "https://nbrosowsky.github.io/tonejs-instruments/samples";

const sets: Record<string, { base: string; notes: string[]; seconds: number }> = {
  piano: {
    base: SALAMANDER,
    notes: [2, 3, 4, 5, 6].flatMap((o) => [`C${o}`, `Ds${o}`, `Fs${o}`, `A${o}`]).concat("C7"),
    seconds: 2.6,
  },
  guitar: {
    base: `${TONEJS}/guitar-acoustic`,
    notes: ["A2", "C3", "Ds3", "Fs3", "A3", "C4", "Ds4", "Fs4", "A4", "C5", "D5"],
    seconds: 2.2,
  },
  cello: {
    base: `${TONEJS}/cello`,
    notes: ["C2", "Ds2", "Gs2", "B2", "D3", "F3", "Gs3", "B3", "D4", "F4", "Gs4", "B4", "C5"],
    seconds: 1.8,
  },
  violin: {
    base: `${TONEJS}/violin`,
    notes: ["G3", "C4", "E4", "G4", "A4", "C5", "E5", "G5", "A5", "C6", "E6", "G6", "A6", "C7"],
    seconds: 1.6,
  },
  flute: {
    base: `${TONEJS}/flute`,
    notes: ["C4", "E4", "A4", "C5", "E5", "A5", "C6", "E6", "A6", "C7"],
    seconds: 1.6,
  },
  clarinet: {
    base: `${TONEJS}/clarinet`,
    notes: ["D3", "F3", "As3", "D4", "F4", "As4", "D5", "F5", "As5", "D6"],
    seconds: 1.6,
  },
};

const raw = mkdtempSync(join(tmpdir(), "chroma-samples-"));
for (const [name, set] of Object.entries(sets)) {
  const out = join("public/samples", name);
  mkdirSync(out, { recursive: true });
  for (const note of set.notes) {
    const res = await fetch(`${set.base}/${note}.mp3`);
    if (!res.ok) throw new Error(`${name}/${note}: ${res.status}`);
    const src = join(raw, `${name}-${note}.mp3`);
    writeFileSync(src, Buffer.from(await res.arrayBuffer()));
    const fade = Math.min(0.5, set.seconds / 3);
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-y", "-i", src,
      "-t", String(set.seconds), "-ac", "1", "-ar", "44100",
      "-af", `afade=t=out:st=${(set.seconds - fade).toFixed(2)}:d=${fade.toFixed(2)}`,
      "-b:a", "80k", join(out, `${note}.mp3`),
    ]);
    process.stdout.write(`${name}/${note} `);
  }
}
console.log("\ndone");
